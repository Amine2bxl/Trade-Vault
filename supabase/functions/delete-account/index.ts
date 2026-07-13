// Permanently deletes the calling user's account and every trace of it:
// storage files, all row data, and the auth.users record. Irreversible.
// Auth: the caller's JWT is verified; a user can only delete themselves.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Missing authentication" }, 401);

    // Identify the caller from their JWT — they can only ever delete themselves.
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);
    const uid = user.id;

    const admin = createClient(url, service);

    // 1. Storage: remove every screenshot the user uploaded.
    const bucket = "trade-screenshots";
    const toRemove: string[] = [];
    for (const prefix of [uid, `${uid}/missed`]) {
      const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      for (const f of files ?? []) {
        if (f.name) toRemove.push(`${prefix}/${f.name}`);
      }
    }
    if (toRemove.length) await admin.storage.from(bucket).remove(toRemove);

    // 2. Row data across every table keyed to the user.
    await admin.from("trades").delete().eq("user_id", uid);
    await admin.from("missed_opportunities").delete().eq("user_id", uid);
    await admin.from("push_subscriptions").delete().eq("user_id", uid);
    await admin.from("profiles").delete().eq("id", uid);

    // 3. The auth account itself. This is the point of no return.
    const { error: dErr } = await admin.auth.admin.deleteUser(uid);
    if (dErr) return json({ error: dErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
