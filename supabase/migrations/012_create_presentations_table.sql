-- Create presentations table
-- This table serves as a parent container for flows, providing presentation-level metadata
-- including the title feature that users can set in the builder

create table if not exists public.presentations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null default 'Untitled Presentation',
  description       text,
  status            text not null default 'draft'
                      check (status in ('draft','published','archived')),
  thumbnail_url     text,            -- optional thumbnail/preview image
  last_accessed_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Add indexes for performance
create index if not exists idx_presentations_user_id on public.presentations(user_id);
create index if not exists idx_presentations_user_updated on public.presentations(user_id, updated_at desc);
create index if not exists idx_presentations_status on public.presentations(status);

-- Add updated_at trigger
create trigger trg_presentations_updated_at
before update on public.presentations
for each row execute procedure public.set_updated_at();

-- Add presentation_id to flows table to link flows to presentations
alter table public.flows 
add column if not exists presentation_id uuid references public.presentations(id) on delete cascade;

-- Create index for the new foreign key
create index if not exists idx_flows_presentation_id on public.flows(presentation_id);

-- Enable RLS on presentations table
alter table public.presentations enable row level security;

-- RLS policies for presentations (owner-only access)
create policy presentations_select_own
  on public.presentations for select
  using (user_id = auth.uid());

create policy presentations_insert_own
  on public.presentations for insert
  with check (user_id = auth.uid());

create policy presentations_update_own
  on public.presentations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy presentations_delete_own
  on public.presentations for delete
  using (user_id = auth.uid());

-- Update flow policies to allow access via presentation ownership
-- This allows users to access flows that belong to their presentations
create policy flows_via_presentation_all
  on public.flows for all
  using (
    presentation_id is not null 
    and exists (
      select 1 from public.presentations p 
      where p.id = presentation_id 
      and p.user_id = auth.uid()
    )
  )
  with check (
    presentation_id is not null 
    and exists (
      select 1 from public.presentations p 
      where p.id = presentation_id 
      and p.user_id = auth.uid()
    )
  );