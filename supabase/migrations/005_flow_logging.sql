-- Enable uuid generation if not already available
create extension if not exists pgcrypto;

-- Reusable trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- ========================
-- Core flow containers
-- ========================

-- One row per slide-building session
create table if not exists public.flows (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  status            text not null default 'active'
                      check (status in ('active','completed','abandoned','error')),
  current_step      text
                      check (current_step in ('upload','theme','research','content','preview','download')),
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_flows_user_id on public.flows(user_id);

create trigger trg_flows_updated_at
before update on public.flows
for each row execute procedure public.set_updated_at();

-- Optional step snapshots per flow
create table if not exists public.flow_steps (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  step              text not null
                      check (step in ('upload','theme','research','content','preview','download')),
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  status            text not null default 'in_progress'
                      check (status in ('pending','in_progress','done','error')),
  input_snapshot    jsonb,
  output_snapshot   jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_flow_steps_flow_id on public.flow_steps(flow_id);

create trigger trg_flow_steps_updated_at
before update on public.flow_steps
for each row execute procedure public.set_updated_at();

-- Append-only event log for training-grade chronology
create table if not exists public.flow_events (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  step              text not null
                      check (step in ('upload','theme','research','content','preview','download')),
  actor             text not null
                      check (actor in ('user','ai','system')),
  event_type        text not null,
  payload           jsonb,
  correlation_id    uuid,
  created_at        timestamptz not null default now()
);

create index if not exists idx_flow_events_flow_time on public.flow_events(flow_id, created_at);
create index if not exists idx_flow_events_corr on public.flow_events(correlation_id);

-- ========================
-- Artifacts per step
-- ========================

-- Per-file artifact (metadata + parsed text)
create table if not exists public.flow_documents (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  filename          text not null,
  file_type         text,
  file_size         bigint,
  storage_path      text,             -- e.g., Supabase Storage path (optional)
  parse_success     boolean not null default false,
  parse_error       text,
  content           text,             -- parsed text (optional / large)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_flow_documents_flow_id on public.flow_documents(flow_id);

create trigger trg_flow_documents_updated_at
before update on public.flow_documents
for each row execute procedure public.set_updated_at();

-- Theme/template choice and palette
create table if not exists public.flow_theme_choices (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  template_id       text,             -- ties to pptx_html_examples.template_id when chosen
  palette           jsonb,            -- ["#RRGGBB", ...]
  palette_source    text not null     -- curated | logo | ai | manual
                      check (palette_source in ('curated','logo','ai','manual')),
  prompt            text,             -- for AI palette generation
  logo_url          text,             -- optional preview path
  created_at        timestamptz not null default now()
);

create index if not exists idx_flow_theme_choices_flow_id on public.flow_theme_choices(flow_id);

-- Research executions (inputs + outputs)
create table if not exists public.flow_research_runs (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  query             text not null,
  options           jsonb,
  result            text,             -- researchData (formatted summary)
  sources           jsonb,            -- list of {title,url,score,...}
  answer            text,             -- AI summary if provided
  status            text not null default 'success'
                      check (status in ('success','no_results','error')),
  duration_ms       integer,
  created_at        timestamptz not null default now()
);

create index if not exists idx_flow_research_runs_flow_id on public.flow_research_runs(flow_id);

-- Content plan (AI plan + user edits)
create table if not exists public.flow_content_plans (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  planning_context  jsonb not null,   -- { description, selectedTheme, hasResearch, documentCount }
  ai_plan           text not null,    -- original plan from /api/plan-content
  user_edit         text,             -- edited version if modified
  final_plan        text,             -- plan used for generation (user_edit || ai_plan)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_flow_content_plans_flow_id on public.flow_content_plans(flow_id);

create trigger trg_flow_content_plans_updated_at
before update on public.flow_content_plans
for each row execute procedure public.set_updated_at();

-- Each generation attempt (preview/regenerate)
create table if not exists public.flow_previews (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  request_payload   jsonb not null,   -- { description, theme, researchData, contentPlan, userFeedback, documents }
  model             text,             -- e.g., 'gpt-4'
  slide_html        text,             -- returned HTML
  success           boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_flow_previews_flow_time on public.flow_previews(flow_id, created_at);

-- Downloads (pptx/html/google_slides)
create table if not exists public.flow_downloads (
  id                uuid primary key default gen_random_uuid(),
  flow_id           uuid not null references public.flows(id) on delete cascade,
  format            text not null
                      check (format in ('pptx','google_slides','html')),
  url               text,             -- if uploaded or share-link (optional)
  success           boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_flow_downloads_flow_id on public.flow_downloads(flow_id);

-- ========================
-- Row Level Security (RLS)
-- ========================

alter table public.flows enable row level security;
alter table public.flow_steps enable row level security;
alter table public.flow_events enable row level security;
alter table public.flow_documents enable row level security;
alter table public.flow_theme_choices enable row level security;
alter table public.flow_research_runs enable row level security;
alter table public.flow_content_plans enable row level security;
alter table public.flow_previews enable row level security;
alter table public.flow_downloads enable row level security;

-- Owner-only access on flows
create policy flows_select_own
  on public.flows for select
  using (user_id = auth.uid());

create policy flows_insert_own
  on public.flows for insert
  with check (user_id = auth.uid());

create policy flows_update_own
  on public.flows for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy flows_delete_own
  on public.flows for delete
  using (user_id = auth.uid());

-- Child tables inherit ownership via parent flow_id
-- Helper expression reused inline:
-- exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid())

create policy flow_steps_owner_all
  on public.flow_steps for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_events_owner_all
  on public.flow_events for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_documents_owner_all
  on public.flow_documents for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_theme_choices_owner_all
  on public.flow_theme_choices for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_research_runs_owner_all
  on public.flow_research_runs for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_content_plans_owner_all
  on public.flow_content_plans for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_previews_owner_all
  on public.flow_previews for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));

create policy flow_downloads_owner_all
  on public.flow_downloads for all
  using (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.flows f where f.id = flow_id and f.user_id = auth.uid()));