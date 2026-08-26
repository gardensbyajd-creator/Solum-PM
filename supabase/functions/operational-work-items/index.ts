import { createClient } from "npm:@supabase/supabase-js@2";

type WorkItemInput = {
  id?: string;
  workType?: "project" | "priority_action";
  title?: string;
  detail?: string;
  status?: "planned" | "in_progress" | "blocked" | "complete";
  riskLevel?: "standard" | "attention" | "critical";
  ownerLabel?: string;
  dueDate?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function resolveMembership(request: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authorization) return { error: json({ error: "Authorisation is required" }, 401) };
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return { error: json({ error: "A valid signed-in user is required" }, 401) };
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role_name")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return { error: json({ error: "Unable to confirm organisation membership" }, 500) };
  if (!membership) return { error: json({ error: "Claim or activate organisation access before recording work." }, 403) };
  return { admin, membership, user: userData.user };
}

Deno.serve(async (request) => {
  const access = await resolveMembership(request);
  if ("error" in access) return access.error;
  const { admin, membership, user } = access;

  if (request.method === "GET") {
    const { data, error } = await admin.from("operational_work_items")
      .select("id, work_type, title, detail, status, risk_level, owner_label, due_date, created_at, updated_at")
      .eq("organization_id", membership.organization_id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return json({ error: "Unable to load organisation work" }, 500);
    return json({ items: data ?? [] });
  }

  if (request.method !== "POST" && request.method !== "PATCH") return json({ error: "Method not allowed" }, 405);
  let input: WorkItemInput;
  try {
    input = await request.json() as WorkItemInput;
  } catch {
    return json({ error: "Invalid work record" }, 400);
  }
  const title = input.title?.trim() ?? "";
  const workType = input.workType;
  const status = input.status ?? "planned";
  const riskLevel = input.riskLevel ?? "standard";
  if (request.method === "PATCH") {
    if (!input.id || !["planned", "in_progress", "blocked", "complete"].includes(status)) return json({ error: "Provide a work item and a valid status." }, 400);
    if (!["master_licence_holder", "administrator"].includes(membership.role_name)) return json({ error: "Only the Master Licence Holder or an administrator can update work status." }, 403);
    const { data: updatedItem, error: updateError } = await admin.from("operational_work_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", membership.organization_id)
      .select("id, work_type, title, detail, status, risk_level, owner_label, due_date, created_at, updated_at")
      .maybeSingle();
    if (updateError || !updatedItem) return json({ error: "Unable to update this organisation work item." }, 500);
    await admin.from("operational_activity_events").insert({
      organization_id: membership.organization_id,
      event_type: `${updatedItem.work_type}.status_updated`,
      title: "Work status updated",
      detail: `${updatedItem.title} is now ${status.replace("_", " ")}.`,
      actor_label: user.email ?? "Organisation administrator",
    });
    return json({ item: updatedItem });
  }
  if (!workType || !["project", "priority_action"].includes(workType) || title.length < 3 || title.length > 180 || !["planned", "in_progress", "blocked", "complete"].includes(status) || !["standard", "attention", "critical"].includes(riskLevel) || (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate))) {
    return json({ error: "Provide a work type, title, status and risk level." }, 400);
  }
  if (workType === "project" && !["master_licence_holder", "administrator"].includes(membership.role_name)) {
    return json({ error: "Only the Master Licence Holder or an administrator can create projects." }, 403);
  }
  const { data: item, error: createError } = await admin.from("operational_work_items").insert({
    organization_id: membership.organization_id,
    work_type: workType,
    title,
    detail: input.detail?.trim() || null,
    status,
    risk_level: riskLevel,
    owner_label: input.ownerLabel?.trim() || null,
    due_date: input.dueDate || null,
    created_by_user_id: user.id,
  }).select("id, work_type, title, detail, status, risk_level, owner_label, due_date, created_at, updated_at").single();
  if (createError) return json({ error: "Unable to record organisation work" }, 500);
  await admin.from("operational_activity_events").insert({
    organization_id: membership.organization_id,
    event_type: `${workType}.created`,
    title: workType === "project" ? "Project recorded" : "Priority action recorded",
    detail: title,
    actor_label: user.email ?? "Organisation member",
  });
  return json({ item }, 201);
});
