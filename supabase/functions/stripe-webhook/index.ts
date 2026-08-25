import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const enterprisePriceId = "price_1U8GLo3a72jjBENAGvEHaHnO";
const additionalSeatPriceId = "price_1U8GMR3a72jjBENA78NPrMe9";
const acceptedStatuses = new Set(["active", "trialing", "past_due"]);

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseStripeSignature(header: string | null) {
  const values = new Map<string, string[]>();
  for (const part of (header ?? "").split(",")) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;
    values.set(key, [...(values.get(key) ?? []), value]);
  }
  return { timestamp: values.get("t")?.[0], signatures: values.get("v1") ?? [] };
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody: string, header: string | null, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(header);
  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  return signatures.some((value) => value === signature);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function findOrCreateOrganization(
  supabase: ReturnType<typeof createClient>,
  stripeCustomerId: string,
  organizationName?: string,
  billingEmail?: string,
) {
  const { data: existing, error: readError } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("organizations")
    .insert({
      stripe_customer_id: stripeCustomerId,
      name: organizationName || "Pending SolumPM organisation",
      billing_email: billingEmail ?? null,
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id as string;
}

async function syncSubscription(supabase: ReturnType<typeof createClient>, subscription: Record<string, unknown>) {
  const stripeSubscriptionId = stringValue(subscription.id);
  const stripeCustomerId = stringValue(subscription.customer);
  const status = stringValue(subscription.status);
  if (!stripeSubscriptionId || !stripeCustomerId || !status) return;

  const organizationId = await findOrCreateOrganization(supabase, stripeCustomerId);
  const currentPeriodEnd = typeof subscription.current_period_end === "number"
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const { error: subscriptionError } = await supabase
    .from("stripe_subscriptions")
    .upsert({
      stripe_subscription_id: stripeSubscriptionId,
      organization_id: organizationId,
      stripe_customer_id: stripeCustomerId,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id" });
  if (subscriptionError) throw subscriptionError;

  const items = (subscription.items as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
  const relevantItems = items.flatMap((item) => {
    const price = item.price as Record<string, unknown> | undefined;
    const priceId = stringValue(price?.id);
    const itemId = stringValue(item.id);
    if (!itemId || !priceId || ![enterprisePriceId, additionalSeatPriceId].includes(priceId)) return [];
    return [{
      stripe_subscription_item_id: itemId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: priceId,
      quantity: typeof item.quantity === "number" ? Math.max(1, item.quantity) : 1,
      updated_at: new Date().toISOString(),
    }];
  });

  if (relevantItems.length > 0) {
    const { error: itemError } = await supabase
      .from("stripe_subscription_items")
      .upsert(relevantItems, { onConflict: "stripe_subscription_item_id" });
    if (itemError) throw itemError;
  }

  const { error: recomputeError } = await supabase.rpc("recompute_organization_entitlement", {
    target_organization_id: organizationId,
  });
  if (recomputeError) throw recomputeError;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) return json({ error: "Webhook configuration incomplete" }, 503);

  const rawBody = await request.text();
  const verified = await verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), webhookSecret);
  if (!verified) return json({ error: "Invalid Stripe signature" }, 400);

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }
  if (!event.id || !event.type || !event.data?.object) return json({ error: "Incomplete Stripe event" }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const object = event.data.object;
  const { data: previousEvent, error: previousEventError } = await supabase
    .from("stripe_webhook_events")
    .select("outcome")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (previousEventError) return json({ error: "Unable to inspect event history" }, 500);
  if (previousEvent?.outcome === "processed" || previousEvent?.outcome === "ignored") {
    return json({ received: true, duplicate: true });
  }

  const { error: eventError } = await supabase.from("stripe_webhook_events").upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_customer_id: stringValue(object.customer),
    stripe_subscription_id: stringValue(object.subscription) ?? stringValue(object.id),
    event_payload: event,
    outcome: "received",
    processed_at: null,
  }, { onConflict: "stripe_event_id" });
  if (eventError) return json({ error: "Unable to record event" }, 500);

  try {
    if (event.type === "checkout.session.completed") {
      const stripeCustomerId = stringValue(object.customer);
      if (stripeCustomerId) {
        const customerDetails = object.customer_details as Record<string, unknown> | undefined;
        const collectedInformation = object.collected_information as Record<string, unknown> | undefined;
        await findOrCreateOrganization(
          supabase,
          stripeCustomerId,
          stringValue(collectedInformation?.business_name),
          stringValue(customerDetails?.email) ?? stringValue(object.customer_email),
        );
      }
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(supabase, object);
    }

    await supabase
      .from("stripe_webhook_events")
      .update({ outcome: ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type) ? "processed" : "ignored", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
    return json({ received: true });
  } catch (error) {
    await supabase
      .from("stripe_webhook_events")
      .update({ outcome: "failed", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
    console.error("Stripe webhook processing failed", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
