revoke all on function public.allocate_organization_seat(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.recompute_organization_entitlement(uuid) from public, anon, authenticated;

grant execute on function public.allocate_organization_seat(uuid, text, text, text) to service_role;
grant execute on function public.recompute_organization_entitlement(uuid) to service_role;
