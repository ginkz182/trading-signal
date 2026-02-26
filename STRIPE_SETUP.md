# Stripe Setup Guide

## Prerequisites
- [Stripe account](https://dashboard.stripe.com/register)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local testing): `brew install stripe/stripe-cli/stripe`

---

## 1. Get API Keys

Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/test/apikeys)

| Key | Starts with | Purpose |
|-----|-------------|---------|
| Secret Key | `sk_test_` / `sk_live_` | Server-side API calls |
| Publishable Key | `pk_test_` / `pk_live_` | Client-side (unused currently) |

Add to `.env`:
```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

## 2. Create Product & Prices

Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)

### Standard Price
1. Create a product (e.g. "Purrfect Resident")
2. Add a **recurring** price: `199 THB / month`
3. Copy the Price ID → `STRIPE_PRICE_ID_PREMIUM`

### Promo Price (Optional)
1. On the same product, click **Add another price**
2. Add a **recurring** price: `99 THB / month` (or your promo rate)
3. Copy the Price ID → `STRIPE_PRICE_ID_PROMO`

Add to `.env`:
```env
STRIPE_PRICE_ID_PREMIUM=price_xxxxx
STRIPE_PRICE_ID_PROMO=price_xxxxx        # Optional
PROMO_PRICE_AMOUNT=9900                   # Promo amount in Satang (for PromptPay)
PROMO_CODE=EARLYBIRD                      # Secret code users type
```

---

## 3. Set Up Webhooks

### Local Development
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
This prints a signing secret like `whsec_xxxxx`. Add it to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Production
1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. URL: `https://yourdomain.com/api/webhooks/stripe`
4. Events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
5. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

---

## 4. Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | Requires 3D Secure |
| `4000 0000 0000 0002` | Declined |

Use any future expiry date and any 3-digit CVC.

---

## 5. Full `.env` Reference

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID_PREMIUM=price_xxxxx

# Promo (optional)
STRIPE_PRICE_ID_PROMO=price_xxxxx
PROMO_PRICE_AMOUNT=9900
PROMO_CODE=EARLYBIRD
```

---

## Architecture

```
User clicks payment button in Telegram
  → Bot creates Stripe Checkout Session (payment.service.js)
  → User pays on Stripe-hosted page
  → Stripe sends webhook POST to /api/webhooks/stripe
  → webhook.controller.js receives it
  → payment.service.js verifies signature & processes event
  → subscriber.service.js upgrades user tier
```

### Key Files
| File | Role |
|------|------|
| `src/config.js` | Stripe keys, price IDs, promo config |
| `src/services/payment.service.js` | Creates checkout sessions, handles webhooks |
| `src/controllers/webhook.controller.js` | Express route for `POST /webhook/stripe` |
| `src/services/telegram-bot-handler.js` | Sends payment buttons, handles callbacks |

---

## Switching to Production

1. Replace all `sk_test_` / `pk_test_` keys with `sk_live_` / `pk_live_` keys
2. Create **live** prices in Stripe and update `STRIPE_PRICE_ID_PREMIUM`
3. Add a **production webhook** endpoint in Stripe Dashboard
4. Update `STRIPE_WEBHOOK_SECRET` with the live signing secret
5. Remove `stripe listen` — no longer needed
