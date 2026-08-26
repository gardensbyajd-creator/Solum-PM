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
  const { data: initialMembership, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role_name")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "Unable to load membership" }, 500);

  let membership = initialMembership;
  if (!membership && userData.user.email) {
    const { data: invitedSeat, error: invitedSeatError } = await admin
      .from("organization_seats")
      .select("id, organization_id, role_name")
      .ilike("email", userData.user.email)
      .eq("seat_status", "invited")
      .maybeSingle();
    if (invitedSeatError) return json({ error: "Unable to inspect invited access" }, 500);
    if (invitedSeat) {
      const assignedRole = invitedSeat.role_name === "administrator" ? "administrator" : "member";
      const { data: activatedMembership, error: activationError } = await admin
        .from("organization_members")
        .upsert({ organization_id: invitedSeat.organization_id, user_id: userData.user.id, role_name: assignedRole, status: "active" }, { onConflict: "organization_id,user_id" })
        .select("organization_id, role_name")
        .single();
      if (activationError) return json({ error: "Unable to activate invited organisation access" }, 500);
      const { error: seatActivationError } = await admin.from("organization_seats")
        .update({ seat_status: "active", activated_at: new Date().toISOString() })
        .eq("id", invitedSeat.id);
      if (seatActivationError) return json({ error: "Unable to activate invited internal seat" }, 500);
      await admin.from("operational_activity_events").insert({
        organization_id: invitedSeat.organization_id,
        event_type: "seat.activated",
        title: "Internal seat activated",
        detail: `${userData.user.email} activated their secure SolumPM access.`,
        actor_label: userData.user.email,
      });
      membership = activatedMembership;
    }
  }

  if (!membership) return json({ claimed: false });
  const organizationId = membership.organization_id;
  const [organizationResult, entitlementResult, onboardingResult, seatsResult, activityResult, workResult] = await Promise.all([
    admin.from("organizations").select("id, name").eq("id", organizationId).single(),
    admin.from("organization_entitlements").select("internal_seat_limit, subscription_state").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_onboarding_sessions").select("status, current_step").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_seats").select("id, email, display_name, role_name, seat_status, invited_at, activated_at").eq("organization_id", organizationId).order("invited_at", { ascending: false }).limit(50),
    admin.from("operational_activity_events").select("title, detail, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
    admin.from("operational_work_items").select("id, work_type, title, detail, status, risk_level, owner_label, due_date, created_at, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
  ]);
  if (organizationResult.error || entitlementResult.error || onboardingResult.error || seatsResult.error || activityResult.error || workResult.error) return json({ error: "Unable to load organisation context" }, 500);
  const occupiedSeats = (seatsResult.data ?? []).filter((seat) => ["invited", "active"].includes(seat.seat_status)).length;
  return json({
    claimed: true,
    organization: organizationResult.data,
    role: membership.role_name,
    entitlement: entitlementResult.data,
    onboarding: onboardingResult.data,
    occupiedSeats,
    seats: seatsResult.data ?? [],
    activity: activityResult.data ?? [],
    workItems: workResult.data ?? [],
  });
});
