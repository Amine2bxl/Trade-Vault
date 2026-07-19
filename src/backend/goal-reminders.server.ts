import { createClient } from "@supabase/supabase-js";
import { sendWebPush, type PushSubRow } from "./push-crypto.server";

// Goal-plan push reminders. Piggybacks on the DAILY lifecycle cron (8:00 UTC,
// see src/server.ts) but only acts on MONDAYS: one weekly nudge listing how
// many of this month's plan actions are still open. Relevant, never spammy.

interface GoalRow {
  id?: string;
  kind?: string;
}

interface PlanRow {
  user_id: string;
  goals: GoalRow[] | null;
  tasks_done: Record<string, boolean> | null;
  started_at: string;
  horizon_months: number;
}

/** Months elapsed since started_at, clamped to the plan horizon. */
function monthIndex(startedAt: string, horizon: number, now: Date): number {
  const start = new Date(`${startedAt}T12:00:00Z`);
  const months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, Math.min(horizon - 1, months));
}

/** Mirror of tasksForMonth's count (src/app/utils/goalPlan.ts):
 *  2 tasks per measured goal, 1 per custom goal, +1 generic. */
function expectedTaskCount(goals: GoalRow[]): number {
  let n = 1; // generic
  for (const g of goals) n += g.kind === "custom" ? 1 : 2;
  return n;
}

const COPY: Record<string, { title: string; body: string }> = {
  en: {
    title: "Your action plan this week 🎯",
    body: "{n} action(s) from month {m} still open. Small steps, big edge — tick one off today.",
  },
  fr: {
    title: "Ton plan d'action cette semaine 🎯",
    body: "{n} action(s) du mois {m} encore ouvertes. Petits pas, gros edge — coche-en une aujourd'hui.",
  },
  es: {
    title: "Tu plan de acción esta semana 🎯",
    body: "{n} acción(es) del mes {m} siguen abiertas. Marca una hoy.",
  },
  pt: {
    title: "O seu plano de ação esta semana 🎯",
    body: "{n} ação(ões) do mês {m} ainda abertas. Conclua uma hoje.",
  },
  de: {
    title: "Dein Aktionsplan diese Woche 🎯",
    body: "{n} Aktion(en) aus Monat {m} noch offen. Hak heute eine ab.",
  },
};

export async function handleGoalRemindersCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const now = new Date();
  // Weekly cadence: Mondays only (the cron itself fires daily).
  if (now.getUTCDay() !== 1) {
    return new Response(JSON.stringify({ skipped: "not monday" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase service credentials missing" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: plans, error } = await sb
    .from("goal_plans")
    .select("user_id, goals, tasks_done, started_at, horizon_months");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let notified = 0;
  for (const plan of (plans ?? []) as PlanRow[]) {
    try {
      const goals = Array.isArray(plan.goals) ? plan.goals : [];
      if (goals.length === 0) continue;
      const horizon = Number(plan.horizon_months) || 6;
      const i = monthIndex(plan.started_at, horizon, now);
      const done = Object.entries(plan.tasks_done ?? {}).filter(
        ([k, v]) => v && k.startsWith(`${i}:`),
      ).length;
      const pending = expectedTaskCount(goals) - done;
      if (pending <= 0) continue;

      const [{ data: subs }, { data: prof }] = await Promise.all([
        sb
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", plan.user_id),
        sb.from("profiles").select("language").eq("id", plan.user_id).maybeSingle(),
      ]);
      if (!subs || subs.length === 0) continue;

      const copy = COPY[(prof?.language as string) ?? "en"] ?? COPY.en;
      await sendWebPush(
        subs as PushSubRow[],
        {
          title: copy.title,
          body: copy.body.replace("{n}", String(pending)).replace("{m}", String(i + 1)),
          url: "/",
          icon: "/icon-512.png",
        },
        async (id) => {
          await sb.from("push_subscriptions").delete().eq("id", id);
        },
      );
      notified++;
    } catch (e) {
      console.error("[goal-reminders] failed for", plan.user_id, e);
    }
  }

  return new Response(JSON.stringify({ plans: (plans ?? []).length, notified }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
