import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendWebPush, type PushSubRow } from "./push-crypto.server";

// Web Push sender for the currently signed-in user. The RFC 8291 encryption
// lives in push-crypto.server.ts, shared with the monthly-report cron.

interface SendInput {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
}

export const sendPushToSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendInput) => input)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", context.userId);
    if (error) throw error;
    const subscriptions = (subs ?? []) as PushSubRow[];

    return sendWebPush(
      subscriptions,
      {
        title: data.title || "TradeVault",
        body: data.body || "You have a new notification",
        url: data.url || "/",
        icon: data.icon || "/icon-512.png",
      },
      // Subscription gone — prune it. RLS allows this: the subscription belongs
      // to the currently authenticated user.
      async (id) => {
        await sb.from("push_subscriptions").delete().eq("id", id);
      },
    );
  });
