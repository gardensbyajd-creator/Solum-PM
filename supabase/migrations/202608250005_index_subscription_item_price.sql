create index if not exists stripe_subscription_items_price_id_idx
  on public.stripe_subscription_items (stripe_price_id);
