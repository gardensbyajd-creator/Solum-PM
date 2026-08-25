# SolumPM Stripe Webhook Setup

## Deployed endpoint

Use one Stripe Workbench event destination for both subscription products:

```text
https://cvqualjefkorrwiqsxkv.supabase.co/functions/v1/stripe-webhook
```

The function is deployed in the `cvqualjefkorrwiqsxkv` Supabase project as `stripe-webhook`. It uses signed Stripe webhook verification rather than browser redirects to grant or change access.

## Post-payment redirect

Once the public SolumPM domain is connected, set the Enterprise Payment Link redirect to:

```text
https://solumpm.com/onboarding?session_id={CHECKOUT_SESSION_ID}
```

The onboarding route gives the subscriber a branded next step, but it does not grant access. The signed Stripe webhook remains the only source of entitlement activation.

## Price mappings

| Subscription product | Stripe price ID | Entitlement result |
|---|---|---|
| SolumPM Enterprise | `price_1U8GLo3a72jjBENAGvEHaHnO` | 25 named internal seats |
| SolumPM Additional 25 Internal Seats | `price_1U8GMR3a72jjBENA78NPrMe9` | One additional 25-seat block |

## Stripe Workbench configuration

Create one event destination with the following events:

| Event | Purpose |
|---|---|
| `checkout.session.completed` | Creates the pending organisation record for a successful checkout. |
| `customer.subscription.created` | Creates the subscription record and calculates the initial 25-seat entitlement. |
| `invoice.paid` | Records payment confirmation for reconciliation. |
| `invoice.payment_failed` | Records a payment-attention event. |
| `customer.subscription.updated` | Updates subscription status, items and the calculated seat allowance. |
| `customer.subscription.deleted` | Removes the associated base or additional-seat entitlement. |

After saving the event destination, Stripe displays a signing secret starting with `whsec_`. In Supabase, add it as the edge-function secret named:

```text
STRIPE_WEBHOOK_SECRET
```

Never place this secret in frontend code, the public Payment Link URL, source control or chat.

## Additional-seat safety rule

Do not publish the Additional 25 Internal Seats Payment Link as a public website link. A standalone Payment Link can create a second Stripe customer, which cannot be safely matched to an existing SolumPM organisation without an authenticated purchase flow.

The production experience should be an in-app **Add 25 seats** action available only to the organisation’s authorised billing administrator. It should attach the subscription item to the existing Stripe customer, then the webhook will recalculate the entitlement.

## Test sequence

1. Create the event destination in Stripe test mode.
2. Store the test-mode `STRIPE_WEBHOOK_SECRET` in the Supabase edge-function secrets.
3. Send a Stripe test event and confirm an event row appears in `stripe_webhook_events`.
4. Test an Enterprise subscription and confirm `organization_entitlements.internal_seat_limit` is 25.
5. Test a linked additional-seat item and confirm the limit becomes 50.
6. Repeat the destination and secret configuration in Stripe live mode before sharing either Payment Link.
