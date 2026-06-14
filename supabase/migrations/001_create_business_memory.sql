-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.business_memory (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at on row changes
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists business_memory_updated_at on public.business_memory;

create trigger business_memory_updated_at
  before update on public.business_memory
  for each row
  execute function public.handle_updated_at();

-- Enable Row Level Security
alter table public.business_memory enable row level security;

-- Allow all operations for now (tighten when you add auth)
create policy "Allow public read access"
  on public.business_memory for select
  using (true);

create policy "Allow public insert access"
  on public.business_memory for insert
  with check (true);

create policy "Allow public update access"
  on public.business_memory for update
  using (true);

create policy "Allow public delete access"
  on public.business_memory for delete
  using (true);

-- Index for faster text search
create index if not exists business_memory_created_at_idx
  on public.business_memory (created_at desc);
