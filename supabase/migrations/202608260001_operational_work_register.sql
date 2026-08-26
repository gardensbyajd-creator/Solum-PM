create table if not exists public.operational_work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_type text not null check (work_type in ('project', 'priority_action')),
  title text not null check (char_length(title) between 3 and 180),
  detail text,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'blocked', 'complete')),
  risk_level text not null default 'standard' check (risk_level in ('standard', 'attention', 'critical')),
  owner_label text,
  due_date date,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_work_items_org_updated_idx
  on public.operational_work_items (organization_id, updated_at desc);

create index if not exists operational_work_items_org_status_idx
  on public.operational_work_items (organization_id, status);

alter table public.operational_work_items enable row level security;
