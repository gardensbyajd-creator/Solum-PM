import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type SetupRequest = {
  currentStep?: number;
  complete?: boolean;
  setupData?: Record<string, unknown>;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authorization) return json({ error: "Authorisation is required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.email) return json({ error: "A valid signed-in user is required" }, 401);

  let input: SetupRequest;
  try {
    input = await request.json() as SetupRequest;
  } catch {
    return json({ error: "Invalid setup request" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: organizations, error: organizationError } = await admin
    .from("organizations")
    .select("id, name, billing_email")
    .ilike("billing_email", userData.user.email)
    .limit(2);
  if (organizationError) return json({ error: "Unable to locate a billing organisation" }, 500);
  if (!organizations || organizations.length !== 1) {
    return json({ error: "No unique verified billing organisation matches this email. Use the billing email that completed the Enterprise subscription." }, 403);
  }

  const organization = organizations[0];
  const { data: entitlement, error: entitlementError } = await admin
    .from("organization_entitlements")
    .select("subscription_state, internal_seat_limit")
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (entitlementError) return json({ error: "Unable to confirm subscription entitlement" }, 500);
  if (entitlement?.subscription_state !== "active") {
    return json({ error: "The Enterprise subscription is not yet active. Wait for Stripe confirmation before claiming the organisation." }, 409);
  }

  const { data: existingMembers, error: memberReadError } = await admin
    .from("organization_members")
    .select("user_id, role_name")
    .eq("organization_id", organization.id)
    .limit(2);
  if (memberReadError) return json({ error: "Unable to inspect organisation access" }, 500);

  const currentMember = existingMembers?.find((member) => member.user_id === userData.user.id);
  if (!currentMember && (existingMembers?.length ?? 0) > 0) {
    return json({ error: "This organisation has already been claimed. Ask its Master Licence Holder to invite you." }, 403);
  }

  if (!currentMember) {
    const { error: memberCreateError } = await admin.from("organization_members").insert({
      organization_id: organization.id,
      user_id: userData.user.id,
      role_name: "master_licence_holder",
      status: "active",
    });
    if (memberCreateError) return json({ error: "Unable to claim organisation access" }, 500);
  }

  const { data: existingSeat, error: seatReadError } = await admin
    .from("organization_seats")
    .select("id, seat_status")
    .eq("organization_id", organization.id)
    .ilike("email", userData.user.email)
    .in("seat_status", ["invited", "active"])
    .maybeSingle();
  if (seatReadError) return json({ error: "Unable to confirm Master Licence Holder seat" }, 500);
  if (!existingSeat) {
    const { error: seatCreateError } = await admin.from("organization_seats").insert({
      organization_id: organization.id,
      email: userData.user.email.toLowerCase(),
      display_name: userData.user.user_metadata?.full_name ?? null,
      role_name: "master_licence_holder",
      seat_status: "active",
      activated_at: new Date().toISOString(),
    });
    if (seatCreateError) return json({ error: "Unable to register the Master Licence Holder seat" }, 500);
  } else if (existingSeat.seat_status === "invited") {
    const { error: seatActivateError } = await admin.from("organization_seats")
      .update({ seat_status: "active", activated_at: new Date().toISOString() })
      .eq("id", existingSeat.id);
    if (seatActivateError) return json({ error: "Unable to activate the Master Licence Holder seat" }, 500);
  }

  const currentStep = Math.max(1, Math.min(5, Math.floor(input.currentStep ?? 1)));
  const status = input.complete ? "completed" : currentStep >= 5 ? "ready_for_review" : "in_progress";
  const { error: onboardingError } = await admin.from("organization_onboarding_sessions").upsert({
    organization_id: organization.id,
    current_step: currentStep,
    status,
    setup_data: input.setupData ?? {},
    completed_at: input.complete ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id" });
  if (onboardingError) return json({ error: "Unable to save organisation setup" }, 500);

  await admin.from("operational_activity_events").insert({
    organization_id: organization.id,
    event_type: input.complete ? "onboarding.completed" : "onboarding.updated",
    title: input.complete ? "Organisation onboarding completed" : "Organisation onboarding updated",
    detail: `Setup stage ${currentStep} recorded by the Master Licence Holder.`,
    actor_label: userData.user.email,
  });

  return json({
    organization: { id: organization.id, name: organization.name },
    role: "master_licence_holder",
    internalSeatLimit: entitlement.internal_seat_limit,
    status,
  });
});
