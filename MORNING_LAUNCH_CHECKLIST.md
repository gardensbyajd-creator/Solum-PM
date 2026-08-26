# SolumPM Morning Activation Checklist

The application foundation, Supabase schema and Edge Functions are deployed. Complete the following in order before treating subscriptions as live access.

## 1. Stripe test-mode verification

- [ ] Ensure the single **SolumPM subscription entitlements** destination includes `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`.
- [ ] Confirm its endpoint is `https://cvqualjefkorrwiqsxkv.supabase.co/functions/v1/stripe-webhook`.
- [ ] Store the test-mode destination signing secret as `STRIPE_TEST_WEBHOOK_SECRET` in Supabase Edge Function secrets.
- [ ] Complete a Stripe **test-mode** Enterprise checkout and verify that a new organisation receives a 25-seat active entitlement.
- [ ] Complete a Stripe **test-mode** additional-seat subscription linked to that organisation and verify that its capacity becomes 50 seats.

## 2. Stripe live-mode configuration

- [ ] Repeat the event-destination configuration in **live mode**, using a separate live-mode `whsec_...` signing secret.
- [ ] Store the live-mode destination signing secret separately as `STRIPE_WEBHOOK_SECRET`; do not replace the test-mode secret during initial live cutover.
- [ ] Confirm the Enterprise Payment Link price is A$55/month + GST for the first 25 named internal users.
- [ ] Confirm the additional-seat price is A$25/month + GST for one fixed block of 25 internal seats, with quantity adjustment disabled until controlled in-app purchase linking is available.
- [ ] Enable terms acceptance only after live Terms of Service and Privacy Policy URLs have been reviewed and configured in Stripe.
- [ ] Keep the additional-seat Payment Link private; expose it later only to an authorised organisation billing administrator.

## 3. Supabase Auth

- [ ] In **Authentication → URL Configuration**, add the deployed SolumPM website URL as an approved redirect URL.
- [ ] Verify the email provider/Magic Link template is enabled and uses a production sender identity before inviting customers.
- [ ] Test the Master Licence Holder billing-email sign-in route; it must claim only a verified active Stripe organisation.

## 4. Public website and domain

- [ ] Deploy the Vite site to the selected hosting provider.
- [ ] Add the public URL to Supabase Auth redirect URLs.
- [ ] After hosting provides the exact record, update GoDaddy DNS for `solumpm.com`. Do not alter existing unrelated records.
- [ ] Set the Enterprise Stripe Payment Link redirect to `https://solumpm.com/onboarding?session_id={CHECKOUT_SESSION_ID}`.

## 5. Final live check

- [ ] Confirm the public page is visible at the live domain.
- [ ] Confirm post-payment return opens `/onboarding` but does not grant access before the signed webhook does.
- [ ] Confirm the command centre shows the verified organisation name and internal-seat usage for a signed-in Master Licence Holder.
- [ ] Capture the Stripe event log and Supabase function log for the first live checkout.

> Never place a Stripe secret key, `whsec_...` signing secret, Supabase service-role key or customer payment data in the browser application, repository or chat.
