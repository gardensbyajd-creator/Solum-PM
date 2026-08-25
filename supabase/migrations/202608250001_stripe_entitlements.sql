create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_email text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_price_mappings (
  stripe_price_id text primary key,
  entitlement_code text not null check (entitlement_code in ('enterprise_25', 'additional_25')),
  seat_units integer not null check (seat_units > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.billing_price_mappings (stripe_price_id, entitlement_code, seat_units)
values
  ('price_1U8GLo3a72jjBENAGvEHaHnO', 'enterprise_25', 25),
  ('price_1U8GMR3a72jjBENA78NPrMe9', 'additional_25', 25)
on conflict (stripe_price_id) do update
set entitlement_code = excluded.entitlement_code,
    seat_units = excluded.seat_units,
    active = true;

create table if not exists public.stripe_subscriptions (
  stripe_subscription_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_subscriptions_organization_id_idx
  on public.stripe_subscriptions (organization_id);

create table if not exists public.stripe_subscription_items (
  stripe_subscription_item_id text primary key,
  stripe_subscription_id text not null references public.stripe_subscriptions(stripe_subscription_id) on delete cascade,
  stripe_price_id text not null references public.billing_price_mappings(stripe_price_id),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_subscription_items_subscription_id_idx
  on public.stripe_subscription_items (stripe_subscription_id);

create table if not exists public.organization_entitlements (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  base_seat_limit integer not null default 0 check (base_seat_limit >= 0),
  additional_seat_blocks integer not null default 0 check (additional_seat_blocks >= 0),
  internal_seat_limit integer not null default 0 check (internal_seat_limit >= 0),
  subscription_state text not null default 'inactive' check (subscription_state in ('active', 'payment_attention', 'inactive')),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_seats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  display_name text,
  role_name text not null,
  seat_status text not null default 'invited' check (seat_status in ('invited', 'active', 'released')),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_seats_active_email_idx
  on public.organization_seats (organization_id, lower(email))
  where seat_status in ('invited', 'active');

create index if not exists organization_seats_capacity_idx
  on public.organization_seats (organization_id, seat_status);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default 'received' check (outcome in ('received', 'processed', 'ignored', 'failed')),
  event_payload jsonb not null
);

create or replace function public.recompute_organization_entitlement(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_limit integer := 0;
  extra_blocks integer := 0;
  has_payment_attention boolean := false;
begin
  select coalesce(sum(mapping.seat_units), 0)
  into base_limit
  from public.stripe_subscriptions subscription
  join public.stripe_subscription_items item on item.stripe_subscription_id = subscription.stripe_subscription_id
  join public.billing_price_mappings mapping on mapping.stripe_price_id = item.stripe_price_id
  where subscription.organization_id = target_organization_id
    and mapping.entitlement_code = 'enterprise_25'
    and subscription.status in ('active', 'trialing', 'past_due');

  select coalesce(sum(item.quantity), 0)
  into extra_blocks
  from public.stripe_subscriptions subscription
  join public.stripe_subscription_items item on item.stripe_subscription_id = subscription.stripe_subscription_id
  join public.billing_price_mappings mapping on mapping.stripe_price_id = item.stripe_price_id
  where subscription.organization_id = target_organization_id
    and mapping.entitlement_code = 'additional_25'
    and subscription.status in ('active', 'trialing', 'past_due');

  select exists(
    select 1
    from public.stripe_subscriptions subscription
    where subscription.organization_id = target_organization_id
      and subscription.status = 'past_due'
  )
  into has_payment_attention;

  insert into public.organization_entitlements (
    organization_id,
    base_seat_limit,
    additional_seat_blocks,
    internal_seat_limit,
    subscription_state,
    updated_at
  )
  values (
    target_organization_id,
    base_limit,
    extra_blocks,
    base_limit + (extra_blocks * 25),
    case
      when base_limit = 0 then 'inactive'
      when has_payment_attention then 'payment_attention'
      else 'active'
    end,
    now()
  )
  on conflict (organization_id) do update
  set base_seat_limit = excluded.base_seat_limit,
      additional_seat_blocks = excluded.additional_seat_blocks,
      internal_seat_limit = excluded.internal_seat_limit,
      subscription_state = excluded.subscription_state,
      updated_at = now();
end;
$$;

revoke all on function public.recompute_organization_entitlement(uuid) from public;

alter table public.organizations enable row level security;
alter table public.billing_price_mappings enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.stripe_subscription_items enable row level security;
alter table public.organization_entitlements enable row level security;
alter table public.organization_seats enable row level security;
alter table public.stripe_webhook_events enable row level security;
