# SolumPM

SolumPM is an independent operational-platform foundation. This repository connects only to the Supabase project with reference `cvqualjefkorrwiqsxkv`.

## Current foundation

| Area | Status |
|---|---|
| Command centre | Built with readiness, activity and membership-control surfaces |
| Organisation onboarding | Built with a five-stage guided setup and local draft recovery |
| Master Licence Holder access | Magic Link sign-in UI and protected organisation-claiming function deployed |
| Enterprise entitlement | Maps `price_1U8GLo3a72jjBENAGvEHaHnO` to 25 named internal seats |
| Additional-seat entitlement | Maps `price_1U8GMR3a72jjBENA78NPrMe9` to one additional 25-seat block |
| Stripe webhook | Deployed as `stripe-webhook`; verifies signed Stripe events before entitlement changes |
| Supabase model | RLS-enabled organisations, subscriptions, entitlement, seats, onboarding, activity and membership tables applied |

## Data-access posture

All operational and billing tables have Row Level Security enabled. The browser does not receive direct table permissions; it reads or changes protected organisation data through JWT-protected Edge Functions. The `stripe-webhook` function is the only custom-authenticated exception because Stripe cannot present a Supabase user JWT; it verifies Stripe’s raw signed payload instead.

The Supabase security advisor may list **RLS enabled with no direct policy** as informational notices. This is intentional for this foundation: direct browser access is denied, while trusted Edge Functions use the service role only after validating the caller or webhook signature. Privileged entitlement-maintenance functions have explicitly had anonymous and signed-in execution revoked.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The local `.env.local` requires only the Supabase URL and publishable client key. Never store Stripe secret keys or webhook signing secrets in the repository or browser environment.

## Stripe activation checklist

1. Keep one Stripe event destination for both SolumPM subscription prices.
2. Use the deployed webhook endpoint:

   ```text
   https://cvqualjefkorrwiqsxkv.supabase.co/functions/v1/stripe-webhook
   ```

3. Include `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, `invoice.paid`, and `invoice.payment_failed`.
4. Store the event destination’s `whsec_...` value as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function secrets.
5. Test an Enterprise subscription in Stripe test mode; the verified entitlement should become 25 seats.
6. Test a linked additional-seat subscription; the verified entitlement should become 50 seats.

Refer to [STRIPE_WEBHOOK_SETUP.md](./STRIPE_WEBHOOK_SETUP.md) for the complete event and safety rules.

For the remaining owner-side live activation tasks, use [MORNING_LAUNCH_CHECKLIST.md](./MORNING_LAUNCH_CHECKLIST.md).

## Payment return route

When the public SolumPM website is deployed, set the Enterprise Payment Link success redirect to:

```text
https://solumpm.com/onboarding?session_id={CHECKOUT_SESSION_ID}
```

This route opens the onboarding workspace but deliberately does **not** grant access. Only a signed Stripe webhook can activate the organisation entitlement.

## Custom domain

No GoDaddy DNS change is required for the existing Supabase Stripe webhook. DNS work is deferred until the public SolumPM application is deployed and a hosting provider provides the required `A` or `CNAME` record. Existing DNS records for other products should remain untouched.
