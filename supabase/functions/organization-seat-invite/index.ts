import { createClient } from "npm:@supabase/supabase-js@2";

type InviteRequest = {
  email?: string;
  displayName?: string;
  roleName?: "administrator" | "member";
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authorization) return json({ error: "Authorisation is required" }, 401);

  let input: InviteRequest;
  try {
    input = await request.json() as InviteRequest;
  } catch {
    return json({ error: "Invalid invitation request" }, 400);
  }

  const email = input.email?.trim().toLowerCase() ?? "";
  const displayName = input.displayName?.trim() ?? "";
  const roleName = input.roleName;
  if (!/^\S+@\S+\.\S+$/.test(email) || !roleName || !["administrator", "member"].includes(roleName)) {
    return json({ error: "Provide a valid internal email and either Administrator or Member access." }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) return json({ error: "A valid signed-in user is required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role_name")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "Unable to confirm organisation access" }, 500);
  if (!membership || !["master_licence_holder", "administrator"].includes(membership.role_name)) {
    return json({ error: "Only the Master Licence Holder or an administrator can invite internal users." }, 403);
  }

  const { data: seat, error: allocationError } = await admin.rpc("allocate_organization_seat", {
    target_organization_id: membership.organization_id,
    target_email: email,
    target_display_name: displayName,
    target_role_name: roleName,
  });
  if (allocationError) {
    const status = /reached|already exists|duplicate/i.test(allocationError.message) ? 409 : 500;
    return json({ error: allocationError.message }, status);
  }

  await admin.from("operational_activity_events").insert({
    organization_id: membership.organization_id,
    event_type: "seat.invited",
    title: "Internal seat invitation created",
    detail: `${email} was assigned ${roleName.replace("_", " ")} access and will consume one internal seat when they activate their Magic Link.`,
    actor_label: userData.user.email ?? "Organisation administrator",
  });

  return json({ seat });
});
