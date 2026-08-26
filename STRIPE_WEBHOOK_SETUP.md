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

The webhook reads active mappings from the protected `billing_price_mappings` table. Sandbox prices are therefore mapped in the database for controlled non-charging verification, not hardcoded into browser code or the webhook source.

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

After saving each event destination, Stripe displays a signing secret starting with `whsec_`. In Supabase Edge Function secrets, use these separate names:

| Stripe destination | Supabase secret name |
|---|---|
| Live-mode destination | `STRIPE_WEBHOOK_SECRET` |
| Test-mode destination | `STRIPE_TEST_WEBHOOK_SECRET` |

The webhook accepts a valid signature from either configured destination. Never place either secret in frontend code, the public Payment Link URL, source control or chat.

If Stripe shows a `400` signature-verification response, reveal the `whsec_...` value from the exact destination that delivered the failed event and replace the corresponding Supabase secret. A live and sandbox destination always have different signing secrets; do not interchange them.

## Additional-seat safety rule

Do not publish the Additional 25 Internal Seats Payment Link as a public website link. A standalone Payment Link can create a second Stripe customer, which cannot be safely matched to an existing SolumPM organisation without an authenticated purchase flow.

The production experience should be an in-app **Add 25 seats** action available only to the organisation’s authorised billing administrator. It should attach the subscription item to the existing Stripe customer, then the webhook will recalculate the entitlement.

## Test sequence

1. Create the event destination in Stripe test mode.
2. Store the test-mode `STRIPE_TEST_WEBHOOK_SECRET` in the Supabase Edge Function secrets.
3. Send a Stripe test event and confirm an event row appears in `stripe_webhook_events`.
4. Test an Enterprise subscription and confirm `organization_entitlements.internal_seat_limit` is 25.
5. Test a linked additional-seat item and confirm the limit becomes 50.
6. Repeat the destination and secret configuration in Stripe live mode before sharing either Payment Link.
