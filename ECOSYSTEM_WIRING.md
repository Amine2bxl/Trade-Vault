# ECOSYSTEM_WIRING.md

Spec for Claude Code. Written against `main` on 2026-08-12.

Turns TradeVault from a set of pages into a loop:

```
Session → Trades → Mistakes → Cluster → Pattern → Proposal → (user confirms) → Rule/Goal/Checklist → Session
```

**Ship in four phases, four PRs.** Phase 1 is useful on its own. Do not start
Phase N+1 before Phase N is merged and verified in a browser. A single big-bang
PR here would be unreviewable and would never land.

## The constraint that governs everything

`GO-LIVE.md` records eight defects of the class *"right number, wrong
interpretation"* found on the audited analytics pages, and four pages still
unaudited. This spec industrialises that risk: it makes the app assert
relationships between behaviour and results, for every user, automatically.

So, three rules apply to every number this system produces:

1. **No claim below minimum sample.** Nothing is surfaced from fewer than
   **20 sessions** or **30 trades** in the compared group. Below that the UI
   says how many more are needed, and shows nothing else.
2. **No causal language, ever.** "Ces sessions sont associées à…" — never
   "parce que", never "ton Readiness Score améliore ton expectancy". The app
   observes correlation on a self-reported variable; it cannot establish cause.
3. **Every displayed statistic carries its n.** If n cannot be rendered next to
   it, the statistic does not ship.

This is not caution for its own sake. A trader who changes behaviour because of
a spurious correlation over 12 sessions is actively harmed by the product.

## Phase 1 — Trading sessions

The keystone. Everything downstream depends on it.

Today the pre-market checklist is ephemeral: config lives in
`profiles.checklist_config` (JSONB), completions are not persisted. Make each
run a durable, dated object.

```sql
create table public.trading_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  account_id         uuid references public.sub_accounts(id) on delete set null,
  session_date       date not null,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  emotional_state    text check (emotional_state in
                       ('calm','focused','tired','anxious','frustrated','overconfident')),
  readiness_score    int check (readiness_score between 0 and 100),
  checklist_snapshot jsonb not null default '{}'::jsonb,
  market_context     text,
  daily_objective    text,
  active_rules       jsonb not null default '[]'::jsonb,
  discipline_score   int check (discipline_score between 0 and 100),
  review_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, account_id, session_date)
);
```

Then `alter table public.trades add column session_id uuid references
public.trading_sessions(id) on delete set null;`

Notes on the design:

- **`checklist_snapshot` is a snapshot, not a reference.** The user will edit
  their checklist template later; a session must keep what was actually ticked
  that morning. Same reasoning for `active_rules`.
- **`readiness_score` is computed, not asked.** Derive it from checklist
  completion, emotional state, and whether risk rules are set. Store the derived
  value plus its inputs — never ask the user to grade themselves, they will
  anchor.
- **`session_id` is nullable and set on a best-effort basis.** A trade logged
  without a session must remain valid. Auto-attach by matching `user_id +
  account_id + date`; never block trade creation on a missing session.
- Backfill existing trades into synthetic sessions **only** with
  `readiness_score = null`. Do not invent a score for the past.
- RLS: owner-only select; user insert/update on own rows (unlike
  `subscriptions`, the user legitimately writes here).

**Phase 1 acceptance:** a session can be opened, filled, closed; the day's trades
attach to it; the session detail view shows them; nothing about analytics has
changed yet. Verified in a browser, mobile and desktop.

## Phase 2 — Mistake taxonomy

Keep all 12 existing mistakes. `trades.mistakes` stays `text[]`. **Do not migrate
trade rows.** Add a mapping layer above them.

```sql
create table public.mistake_clusters (
  id          text primary key,          -- 'fomo', 'plan_violation', 'risk', 'exit'
  label_key   text not null,             -- i18n key, not a literal string
  severity    int not null default 1
);

create table public.mistake_taxonomy (
  mistake     text primary key,          -- must match MISTAKE_OPTIONS exactly
  cluster_id  text not null references public.mistake_clusters(id)
);
```

Seed:

| Cluster | Mistakes |
|---|---|
| `fomo` | FOMO entry, Chased entry, Ignored market conditions |
| `plan_violation` | Ignored plan, Size too large, Averaged down |
| `risk` | No stop loss, Overtrading, Revenge trade, Low liquidity |
| `exit` | Premature exit, Holding too long |

Two invariants, both enforced by tests:

- Every value in `MISTAKE_OPTIONS` maps to exactly one cluster. Adding an option
  without mapping it fails CI (same pattern as `tests/sections.test.ts`).
- Cluster labels go through i18n keys. Ten locales are at 26 % coverage per
  `GO-LIVE.md` §2.10 — do not add new untranslated literals.

## Phase 3 — Pattern detection, deterministic

This is where the product becomes different, and where it can most easily lie.

**The engine finds patterns. The LLM only phrases them.** That rule already
exists in the codebase ("le LLM écrit de la prose, les nombres viennent des
moteurs déterministes"). Extend it: the LLM must never decide *that* a pattern
exists, nor invent a threshold, nor propose a rule that the engine did not emit.

Run as an `ai_jobs` job of kind `pattern_scan` — already declared in
`_pending_20260718160000_ai_os_foundation.sql`. Apply that migration as part of
this phase.

```sql
create table public.detected_patterns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,      -- 'cluster_concentration','time_of_day','after_loss','weekday'
  cluster_id   text references public.mistake_clusters(id),
  evidence     jsonb not null,     -- {n, comparison_n, metric, value, baseline}
  impact_r     numeric,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  dismissed_at timestamptz
);
```

`evidence` is mandatory and must contain `n`. A pattern row without a sample
size is a bug, not a degraded case.

Detectors for this phase, in order of value:

1. **Cluster concentration** — share of losses attributable to one cluster.
2. **After-loss degradation** — performance on trade N+1 following a loss.
3. **Time-of-day** — only for users with ≥30 trades spread across ≥3 buckets.
4. **Readiness correlation** — requires ≥20 sessions with a score. Report as
   observed association with both group sizes shown.

A dismissed pattern does not resurface for 30 days, and never with the same
wording.

## Phase 4 — Jarvis proposals with audit trail

```sql
create table public.agent_proposals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  pattern_id   uuid references public.detected_patterns(id) on delete set null,
  action_type  text not null check (action_type in
                 ('create_rule','create_goal','add_checklist_item','create_mission','add_tag','add_note')),
  payload      jsonb not null,
  rationale    text not null,
  status       text not null default 'pending'
                 check (status in ('pending','accepted','dismissed','expired')),
  decided_at   timestamptz,
  applied_ref  text,               -- id of the object actually created
  created_at   timestamptz not null default now()
);
```

Flow, non-negotiable:

```
engine emits pattern → engine derives candidate action → proposal row (pending)
  → user sees it in Jarvis → [Accepter] / [Ignorer]
  → on accept: server validates payload against a schema, creates the object,
    writes applied_ref, sets accepted
```

Hard constraints:

- **Jarvis writes nothing directly.** No tool call mutates user data. The only
  write path is accepting a proposal.
- **`payload` is validated server-side with zod** against a per-`action_type`
  schema before anything is created. Never trust an LLM-shaped object.
- **Proposals expire** after 14 days as `expired`. A stale suggestion based on
  data from three weeks ago is noise.
- **Intervention budget: at most 3 pending proposals at a time, at most 1 new
  per day.** Without this the app becomes a nag and users disable it — which
  costs you the entire feature, not just that proposal. If the engine finds
  five patterns, surface the highest `impact_r` and hold the rest.
- Every transition is auditable: who, when, what was created. `applied_ref` is
  what makes "Jarvis a créé ceci" verifiable rather than claimed.

## What this spec deliberately does not do

The chain `Pattern → Lesson → Checklist → Goal → Mission → Notification →
Weekly Review` is the right long-term shape, but automating the whole chain now
would mean the app reorganises the user's workflow on the strength of
correlations computed over a few dozen sessions.

Phases 1–4 build the machinery and stop at **one confirmed action per pattern**.
Chaining comes after real usage data exists — and after the four unaudited
analytics pages (`GO-LIVE.md` §2.9) have been reviewed for the same class of
defect.

## Global acceptance criteria

- [ ] No statistic renders without its `n` visible
- [ ] Below-threshold groups show "X sessions de plus nécessaires", nothing else
- [ ] No causal wording in any locale (grep for "parce que", "car", "améliore")
- [ ] Trades still save with no session open
- [ ] `MISTAKE_OPTIONS` ↔ cluster mapping test fails when a mistake is unmapped
- [ ] Jarvis cannot mutate data outside proposal acceptance (verified by test)
- [ ] Rejected proposal payload (schema violation) creates nothing and logs
- [ ] Max 3 pending / 1 new per day, enforced server-side
- [ ] Accepting a proposal produces `applied_ref` pointing at a real object
- [ ] All new labels are i18n keys, `fr` and `en` complete
