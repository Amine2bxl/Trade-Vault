import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateReportForUser } from "./monthly-reports.server";

// On-demand generation for the signed-in user (the cron covers everyone
// automatically; this powers the "generate now" button on the Reports page).
// Runs with the user's RLS client — the insert passes the own-row policy.

const Input = z.object({
  /** YYYY-MM; must be the current or a past month */
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const generateMyMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const nowMonth = new Date().toISOString().slice(0, 7);
    if (data.month > nowMonth) throw new Error("Cannot generate a report for a future month");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const report = await generateReportForUser(sb, context.userId, data.month);
    return { report };
  });
