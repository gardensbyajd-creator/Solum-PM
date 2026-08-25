create table if not exists public.organization_onboarding_sessions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'ready_for_review', 'completed')),
  current_step integer not null default 1 check (current_step between 1 and 5),
  setup_data jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  actor_label text,
  created_at timestamptz not null default now()
);

create index if not exists operational_activity_events_org_created_idx
  on public.operational_activity_events (organization_id, created_at desc);

create or replace function public.allocate_organization_seat(
  target_organization_id uuid,
  target_email text,
  target_display_name text,
  target_role_name text
)
returns public.organization_seats
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement public.organization_entitlements;
  occupied_count integer;
  allocated public.organization_seats;
begin
  select * into entitlement
  from public.organization_entitlements
  where organization_id = target_organization_id
  for update;

  if entitlement.organization_id is null or entitlement.subscription_state <> 'active' then
    raise exception 'A verified active subscription is required before allocating internal seats';
  end if;

  select count(*) into occupied_count
  from public.organization_seats
  where organization_id = target_organization_id
    and seat_status in ('invited', 'active');

  if occupied_count >= entitlement.internal_seat_limit then
    raise exception 'The organisation has reached its % internal-seat limit', entitlement.internal_seat_limit;
  end if;

  insert into public.organization_seats (
    organization_id,
    email,
    display_name,
    role_name,
    seat_status
  )
  values (
    target_organization_id,
    lower(trim(target_email)),
    nullif(trim(target_display_name), ''),
    trim(target_role_name),
    'invited'
  )
  returning * into allocated;

  return allocated;
end;
$$;

revoke all on function public.allocate_organization_seat(uuid, text, text, text) from public;

alter table public.organization_onboarding_sessions enable row level security;
alter table public.operational_activity_events enable row level security;
