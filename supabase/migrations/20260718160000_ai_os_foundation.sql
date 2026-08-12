-- ============================================================================
-- AI OPERATING SYSTEM — data-model foundation (ADDITIVE, NOT YET APPLIED)
-- ============================================================================
-- Scaffolding for the AI OS. Ship this only when the AI systems are actually
-- built. 100% additive: new tables + the pgvector extension, nothing existing
-- is touched. Every table is owner-only via RLS, matching the existing schema.
--
-- NOTE: `vector(1536)` assumes a 1536-dim embedding model (e.g. OpenAI
-- text-embedding-3-small). If a different EmbeddingProvider is chosen, adjust
-- the dimension here and in the provider — it is the one model-coupled number.

-- ── Semantic memory / RAG store ──────────────────────────────────────────────
create extension if not exists vector;

create table if not exists public.ai_embeddings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('trade','note','lesson','report','rule')),
  source_id   text not null,
  content     text not null,
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, source, source_id)
);

alter table public.ai_embeddings enable row level security;

create policy "ai_embeddings_select_own"
  on public.ai_embeddings for select to authenticated
  using (auth.uid() = user_id);
-- Writes go through the server (service role) during indexing jobs.

-- IVFFlat cosine index for fast top-k retrieval. Built now so retrieval is
-- indexed from day one; lists tuned later as the corpus grows.
create index if not exists ai_embeddings_user_idx on public.ai_embeddings (user_id);
create index if not exists ai_embeddings_vec_idx
  on public.ai_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── Background jobs queue ────────────────────────────────────────────────────
create table if not exists public.ai_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in
                  ('daily_brief','weekly_review','embed_backfill','pattern_scan','risk_scan')),
  status        text not null default 'queued'
                  check (status in ('queued','running','done','failed')),
  payload       jsonb not null default '{}'::jsonb,
  result        jsonb,
  scheduled_for timestamptz not null default now(),
  attempts      int not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.ai_jobs enable row level security;

create policy "ai_jobs_select_own"
  on public.ai_jobs for select to authenticated
  using (auth.uid() = user_id);
-- Enqueue/claim/complete all run server-side (service role); no user writes.

create index if not exists ai_jobs_due_idx
  on public.ai_jobs (scheduled_for) where status = 'queued';

-- ── Agent-run telemetry / audit ──────────────────────────────────────────────
create table if not exists public.ai_agent_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  agent         text not null,
  intent        text not null,
  provider      text,
  model         text,
  status        text not null check (status in ('ok','error')),
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  input_summary text,
  output_summary text,
  error         text,
  created_at    timestamptz not null default now()
);

alter table public.ai_agent_runs enable row level security;

create policy "ai_agent_runs_select_own"
  on public.ai_agent_runs for select to authenticated
  using (auth.uid() = user_id);
-- Written server-side (service role) after each agent run.

create index if not exists ai_agent_runs_user_idx
  on public.ai_agent_runs (user_id, created_at desc);
