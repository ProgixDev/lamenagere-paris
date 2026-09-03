# Environments

Two tiers. **Development** is your machine and never touches real money.
**Production** is the App Store app + Vercel and only ever uses live keys.

The rule that makes this work: **a file on your laptop cannot change what
production ships.** Production values live in EAS and Vercel; local `.env`
files are excluded from every build.

| | development | production |
|---|---|---|
| Mobile values from | `.env` (local Metro) / EAS `development` | EAS `production` |
| API | `http://localhost:3333` | `https://lamenagere-paris.vercel.app` |
| Stripe | **test mode** — `pk_test_` / `sk_test_` | **live** — `pk_live_` / `sk_live_` |
| Server values from | `server/.env` | Vercel → Settings → Environment Variables |
| Supabase | `trpluywvtaecvarrzugp` | `trpluywvtaecvarrzugp` — **the same project** |

> **The database is shared.** Stripe is isolated, Supabase is not: orders,
> accounts and uploads you create in dev land in the production database.
> Splitting it needs a second Supabase project — see *Adding a staging tier*.

---

## Running development

```bash
# 1. backend, Stripe test mode
cd server && npm run start:dev
#    boot log confirms the tier:  🌍 APP_ENV=development · 💳 Stripe TEST

# 2. Stripe webhooks into localhost (optional; the confirm endpoint works
#    without it, the webhook backstop does not)
stripe listen --forward-to localhost:3333/payments/webhook
#    paste the whsec_… it prints into server/.env → STRIPE_WEBHOOK_SECRET

# 3. the app
npm start
```

Payments need a **native dev build** — `StripeGate` disables checkout in Expo
Go, which has no Stripe native module. Test cards: `4242 4242 4242 4242`.

Not the simulator? `EXPO_PUBLIC_API_URL` in `.env` must be reachable from the
device: `http://10.0.2.2:3333` on an Android emulator, your Mac's LAN IP on a
physical phone.

## Shipping to production

```bash
npm run env:check     # every tier internally consistent? (see below)
npm run ota           # JS-only change → --environment production
eas build --profile production --platform all   # native change
```

`npm run ota` and every EAS build pass `--environment production`, so they pull
from the EAS `production` environment and **ignore your local `.env`**. That is
why a live key can never be replaced by a laptop's test key by accident — and
also why changing a production value means editing EAS, not a file:

```bash
eas env:list --environment production
eas env:create production --name EXPO_PUBLIC_API_URL --value https://… --force
```

Native config changes (anything in `app.json`) need a real build, not an OTA —
bump `app.json` version first. See `OTA.md`.

---

## Where each secret lives

| Secret | development | production |
|---|---|---|
| `EXPO_PUBLIC_*` | `.env` (git-ignored) | EAS `production` environment |
| `STRIPE_SECRET_KEY` | `server/.env` (`sk_test_`) | Vercel → Production (`sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | from `stripe listen`, new every run | Vercel → Production |
| Supabase service-role, APNs, Apple | `server/.env` | Vercel → Production |
| `SMTP_*` (factures are emailed automatically) | `server/.env` | Vercel → Production |
| Admin dashboard | `super_admin/.env` | its own Vercel project |

No env file is committed. `.env.example` in each of the three projects records
the *shape*; `.easignore` and both `.gitignore`s exclude the real ones.

## The two guardrails

**1. The server refuses to boot on a tier mismatch.**
`server/src/config/env.validation.ts` compares `APP_ENV` against the
`STRIPE_SECRET_KEY` prefix and throws on either mismatch — a live key on a dev
box, or a test key in production. Nothing to configure on Vercel: `APP_ENV`
defaults from Vercel's own `VERCEL_ENV`, so only the *production* deployment
gets the live tier, preview deploys get the safe one, and a laptop with no
`VERCEL_ENV` at all is always development.

**2. `npm run env:check` cross-checks the app side.**
It reads `.env` and all three EAS environments and fails when the API URL and
the publishable key disagree about their tier — the failure that broke live
checkout once already (a `pk_test_` bundle against the `sk_live_` server, fixed
by OTA `ba95b671`). Run it before an OTA or a store build.

## The Stripe webhook

Unlike `sk_`/`pk_`, a `whsec_` secret **does not say which tier it belongs
to** — so neither guard above can check it. The tier is checked on the event
instead: `handleWebhook` drops any delivery whose `livemode` disagrees with
`APP_ENV`, answering 200 without claiming it in `stripe_webhook_events` (a
retry cannot fix a misconfiguration, and claiming it would poison the ledger
for the deploy that *should* apply the same delivery).

That matters here because the two tiers share one database. A live secret
pasted into `server/.env` passes signature verification perfectly — the
`livemode` check is what stops it from reconciling real orders from a laptop.

**Development** — there is no test-mode endpoint to create in the dashboard;
`stripe listen` *is* the sandbox webhook, and it forwards every event type, so
there is nothing to subscribe to either.

Development uses a **different Stripe account** from production —
`acct_1TjXM3C1XrjpLABr` ("Lamenagereparis sandbox"), not the test mode of the
live account. So the CLI has to be told which account to listen on, or it will
happily forward the wrong one's events (which the `livemode` check then drops):

```bash
stripe listen --api-key "$(grep '^STRIPE_SECRET_KEY=' server/.env | cut -d= -f2)" \
  --forward-to localhost:3333/payments/webhook
# paste the whsec_… it prints into server/.env, restart the server
```

That secret belongs to your Stripe CLI login and is stable across restarts.

Whether you need it running depends on what you are testing:

| Testing | Needs `stripe listen`? |
|---|---|
| Checkout, payment sheet, order creation | **No** — `POST /payments/confirm-draft` re-verifies with Stripe itself |
| An app that dies right after paying | Yes — that orphaned draft is finalized by `payment_intent.succeeded` |
| **Refunds** | **Yes** — `refundOrder` records what Stripe says *now*, and a card refund answers `pending`; only `refund.updated` promotes it to `succeeded`. Without it the order sits at `requested`/`pending` forever and the customer keeps reading "en cours" |
| Disputes | Yes — there is no other path at all |

Never point a **test-mode** dashboard endpoint at the production URL to avoid
running the CLI: it writes to the shared production database, and the
`livemode` check refuses every delivery anyway. A test-mode dashboard endpoint
only makes sense once a staging server exists (see below).

**Production** — one dashboard endpoint at
`https://lamenagere-paris.vercel.app/payments/webhook`, its signing secret in
Vercel. It must be subscribed to all nine events the handler acts on;
`refund.updated` is the one to check, because without it a refund that bounces
days later is invisible:

| | |
|---|---|
| payment | `payment_intent.succeeded`, `payment_intent.payment_failed` |
| refunds | `charge.refunded`, `refund.created`, **`refund.updated`**, `refund.failed` |
| disputes | `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` |

Anything else is recorded as `ignored` and dropped, so over-subscribing is
harmless. `charge.refund.updated` is the legacy name for `refund.updated`;
both are accepted.

To check the endpoint is alive without sending a real event — the reply
discriminates between the three ways it breaks:

```bash
curl -sX POST https://lamenagere-paris.vercel.app/payments/webhook \
  -H 'stripe-signature: t=1,v1=0000000000000000000000000000000000000000000000000000000000000000' \
  -H 'content-type: application/json' -d '{}'
```

| Reply | Meaning |
|---|---|
| `No signatures found matching…` | healthy — raw body intact **and** secret present |
| `Webhook secret not configured on this deployment` | secret missing from Vercel |
| `Missing Stripe signature or body` | `rawBody: true` regression in `serverless.ts` |

> Row 2 only discriminates from the deploy that added it. Before that, an unset
> secret was defaulted to `''` and Stripe reported it as an ordinary "no
> signatures found matching" — so the probe run on 2026-08-24 that concluded
> "secret present on Vercel" could not actually have told the difference.
> Re-run it after the next deploy to establish that for real.

The last one is not hypothetical: `serverless.ts` was missing that option and
the webhook was dead on Vercel for months while working locally, because
`main.ts` and `serverless.ts` build the app independently. Any option added to
one must be added to the other.

## About the `preview` profile

`preview` is an internal-distribution build of **what production ships** —
prod API, live key — so it exercises the real thing. Its values are in the EAS
`preview` environment (they used to be hardcoded in `eas.json`, which is how a
key got edited in a committed file).

That means **payments in a preview build charge real cards.** To test checkout,
use the development tier.

## Adding a staging tier later

The plumbing is already in place; only the values are missing.

1. Create a second Supabase project, apply `server/supabase/migrations/*.sql`
   in order (42 of them), seed with `npm run seed`.
2. Push a `staging` branch of the server repo. Vercel builds it as a **preview
   deployment**, which sets `VERCEL_ENV=preview` — so the guard automatically
   puts it on the development tier and demands `sk_test_` in Vercel's Preview
   scope. Point its Supabase vars at the new project.
3. Repoint the EAS `preview` environment at that URL and the `pk_test_` key,
   and drop the `expected: null` on `preview` in `scripts/check-env.mjs`.

Step 2 needs no code change — the guard was written for it.
