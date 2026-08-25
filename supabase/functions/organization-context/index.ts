import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authorization) return json({ error: "Authorisation is required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "A valid signed-in user is required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role_name")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "Unable to load membership" }, 500);
  if (!membership) return json({ claimed: false });

  const organizationId = membership.organization_id;
  const [organizationResult, entitlementResult, onboardingResult, seatsResult, activityResult] = await Promise.all([
    admin.from("organizations").select("id, name").eq("id", organizationId).single(),
    admin.from("organization_entitlements").select("internal_seat_limit, subscription_state").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_onboarding_sessions").select("status, current_step").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_seats").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("seat_status", ["invited", "active"]),
    admin.from("operational_activity_events").select("title, detail, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (organizationResult.error || entitlementResult.error || onboardingResult.error || seatsResult.error || activityResult.error) return json({ error: "Unable to load organisation context" }, 500);
  return json({
    claimed: true,
    organization: organizationResult.data,
    role: membership.role_name,
    entitlement: entitlementResult.data,
    onboarding: onboardingResult.data,
    occupiedSeats: seatsResult.count ?? 0,
    activity: activityResult.data ?? [],
  });
});
