import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendWebPush, type PushSubRow } from "./push-crypto.server";

// Web Push sender for the currently signed-in user. The RFC 8291 encryption
// lives in push-crypto.server.ts, shared with the monthly-report cron.

const sendInputSchema = z.object({
  title: z.string().max(100).optional(),
  body: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  icon: z.string().max(200).optional(),
});

export const sendPushToSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendInputSchema.parse(input))
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
