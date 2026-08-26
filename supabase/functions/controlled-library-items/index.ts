import { createClient } from "npm:@supabase/supabase-js@2";

type LibraryInput = {
  id?: string;
  resourceType?: "policy" | "procedure" | "form";
  title?: string;
  lifecycleStatus?: "draft" | "active" | "retired";
  currentVersion?: string;
  ownerLabel?: string;
  reviewDate?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function accessFor(request: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authorization) return { error: json({ error: "Authorisation is required" }, 401) };
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return { error: json({ error: "A valid signed-in user is required" }, 401) };
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership, error: membershipError } = await admin.from("organization_members")
    .select("organization_id, role_name")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) return { error: json({ error: "Claim or activate organisation access before managing the controlled library." }, 403) };
  return { admin, membership, user: userData.user };
}

Deno.serve(async (request) => {
  const access = await accessFor(request);
  if ("error" in access) return access.error;
  const { admin, membership, user } = access;
  const canManage = ["master_licence_holder", "administrator"].includes(membership.role_name);

  if (request.method === "GET") {
    const { data, error } = await admin.from("controlled_library_items")
      .select("id, resource_type, title, lifecycle_status, current_version, owner_label, review_date, created_at, updated_at")
      .eq("organization_id", membership.organization_id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return json({ error: "Unable to load controlled library" }, 500);
    return json({ items: data ?? [] });
  }

  if (!canManage) return json({ error: "Only the Master Licence Holder or an administrator can change controlled library records." }, 403);
  let input: LibraryInput;
  try { input = await request.json() as LibraryInput; } catch { return json({ error: "Invalid controlled-library record" }, 400); }
  const validStatuses = ["draft", "active", "retired"];
  if (request.method === "PATCH") {
    const lifecycleStatus = input.lifecycleStatus;
    if (!input.id || !lifecycleStatus || !validStatuses.includes(lifecycleStatus)) return json({ error: "Provide a controlled-library item and lifecycle status." }, 400);
    const { data: item, error } = await admin.from("controlled_library_items")
      .update({ lifecycle_status: lifecycleStatus, updated_at: new Date().toISOString() })
      .eq("id", input.id).eq("organization_id", membership.organization_id)
      .select("id, resource_type, title, lifecycle_status, current_version, owner_label, review_date, created_at, updated_at").maybeSingle();
    if (error || !item) return json({ error: "Unable to update controlled-library lifecycle." }, 500);
    await admin.from("operational_activity_events").insert({ organization_id: membership.organization_id, event_type: "library.lifecycle_updated", title: "Controlled library lifecycle updated", detail: `${item.title} is now ${lifecycleStatus}.`, actor_label: user.email ?? "Organisation administrator" });
    return json({ item });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const title = input.title?.trim() ?? "";
  if (!input.resourceType || !["policy", "procedure", "form"].includes(input.resourceType) || title.length < 3 || title.length > 180 || !/^\d+(\.\d+){0,2}$/.test(input.currentVersion ?? "0.1") || (input.reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.reviewDate))) {
    return json({ error: "Provide a resource type, title, version and valid review date." }, 400);
  }
  const { data: item, error } = await admin.from("controlled_library_items").insert({
    organization_id: membership.organization_id,
    resource_type: input.resourceType,
    title,
    lifecycle_status: input.lifecycleStatus ?? "draft",
    current_version: input.currentVersion ?? "0.1",
    owner_label: input.ownerLabel?.trim() || null,
    review_date: input.reviewDate || null,
    created_by_user_id: user.id,
  }).select("id, resource_type, title, lifecycle_status, current_version, owner_label, review_date, created_at, updated_at").single();
  if (error) return json({ error: "Unable to record controlled-library item" }, 500);
  await admin.from("operational_activity_events").insert({ organization_id: membership.organization_id, event_type: "library.item_created", title: "Controlled library item recorded", detail: `${item.title} v${item.current_version} is in ${item.lifecycle_status}.`, actor_label: user.email ?? "Organisation administrator" });
  return json({ item }, 201);
});
