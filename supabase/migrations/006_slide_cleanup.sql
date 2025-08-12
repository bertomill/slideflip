-- Ensure pgcrypto (for UUIDs) exists
create extension if not exists pgcrypto;

-- 1) pptx_html_examples: make template_id unique (used as selector) + created_at index
create unique index if not exists ux_pptx_html_examples_template_id
on public.pptx_html_examples(template_id);

create index if not exists idx_pptx_html_examples_created_at
on public.pptx_html_examples(created_at desc);

-- 2) slide_templates: optional name index for quick lookups
create index if not exists idx_slide_templates_name
on public.slide_templates(lower(name));

-- 3) slide_documents: link to flows and capture parse status (non‑breaking)
alter table public.slide_documents
  add column if not exists flow_id uuid references public.flows(id) on delete cascade,
  add column if not exists storage_path text,
  add column if not exists parse_success boolean not null default false,
  add column if not exists parse_error text;

-- Keep session_id for back-compat. Once migrated, you can drop it:
-- alter table public.slide_documents drop column session_id;

-- 3a) helpful indexes
create index if not exists idx_slide_documents_flow_id on public.slide_documents(flow_id);
create index if not exists idx_slide_documents_created_at on public.slide_documents(created_at desc);

-- 3b) updated_at trigger (if table doesn’t have one yet)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_slide_documents_updated_at on public.slide_documents;
create trigger trg_slide_documents_updated_at
before update on public.slide_documents
for each row execute procedure public.set_updated_at();

-- 3c) RLS to inherit flow ownership (optional but recommended)
alter table public.slide_documents enable row level security;

create policy slide_documents_owner_all
  on public.slide_documents for all
  using (flow_id is null or exists (
    select 1 from public.flows f where f.id = slide_documents.flow_id and f.user_id = auth.uid()
  ))
  with check (flow_id is null or exists (
    select 1 from public.flows f where f.id = slide_documents.flow_id and f.user_id = auth.uid()
  ));