create table if not exists public.controlled_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null check (resource_type in ('policy', 'procedure', 'form')),
  title text not null check (char_length(title) between 3 and 180),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'active', 'retired')),
  current_version text not null default '0.1' check (char_length(current_version) between 1 and 24),
  owner_label text,
  review_date date,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists controlled_library_items_org_status_idx
  on public.controlled_library_items (organization_id, lifecycle_status, updated_at desc);

alter table public.controlled_library_items enable row level security;
