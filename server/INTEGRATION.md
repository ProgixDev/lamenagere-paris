# Integration guide — wiring the apps to the backend

This is the remaining **Iteration 7** work. Do these once the database is live
(migrations applied + seeded) so each step can be verified against real data.

## 0. Bring the backend up

```bash
cd backend
cp .env.example .env          # fill SUPABASE_URL / SERVICE_ROLE_KEY / JWT_SECRET
# Apply migrations (MCP apply_migration, or supabase db push) in order:
#   0001_init_auth → 0002_catalog → 0003_commerce → 0004_messaging_admin → 0005_push_campaigns
npm run seed                  # set ADMIN_EMAIL / ADMIN_PASSWORD first for the admin login
npm run start:dev             # http://localhost:3000/health
```

## 1. Mobile app (Expo)

1. **Point at the backend.** Create `.env` at the repo root:
   `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000` (the app reads it in
   `lib/constants.ts`). Use the LAN IP, not localhost, for a device.
2. **Remove mock fallbacks** so failures surface instead of faking success —
   `features/auth/store.ts` (`login`/`register` catch blocks fall back to
   `MOCK_USER`/`MOCK_TOKEN`). Replace with real error handling. Audit other
   `features/*/store.ts` for local-only fallbacks (orders/messaging) and switch
   the hooks to the API.
3. **Google sign-in** (mobile only): add `expo-auth-session`/Google provider,
   obtain the Google `idToken`, then `POST /auth/oauth/google { idToken }` and
   store the returned `token` in SecureStore (`auth_token`) exactly like the
   email flow.
4. **Push registration**: with `expo-notifications`, get the Expo push token on
   login and `POST /notifications/register-device { token, platform, provider:'expo' }`.
   For raw FCM on Android, send `provider:'fcm'` with the native FCM token.
   Unregister on logout.

The mobile REST contract is already implemented by the backend — endpoints,
field names, and bare-array-vs-paginated shapes match `lib/types.ts` and
`features/*/api.ts`.

## 2. Super admin (Next.js)

1. `cp .env.local.example .env.local`; set `NEXT_PUBLIC_API_URL` and Supabase
   anon key.
2. **Real login** (`src/app/login/page.tsx`): replace the hardcoded check with a
   Supabase email/password sign-in (`@supabase/supabase-js`), then
   `setToken(session.access_token)` from `src/lib/api.ts`. Only `role in
   (admin, super_admin)` should pass (the backend enforces this on every
   `/admin/*` route).
3. **Migrate pages off mock data** using `adminApi` in `src/lib/api.ts`:
   dashboard → `adminApi.dashboard()`, products list/edit → `adminApi.products.*`
   (+ `api.upload(file)` for images), orders → `adminApi.orders.*`, quotes →
   `adminApi.quotes.*`, customers, categories, featured, settings, campaigns.
   The backend already returns the admin display shapes
   (`super_admin/src/lib/types.ts`): `total`/`priceLabel` strings, `statusLabel`,
   `avatarInitials`, derived `stock`.

## 3. Stripe (deferred)

`POST /payments/create-intent` returns 501 today. When ready, implement the
intent + `/payments/webhook`, then have mobile checkout call it before
`POST /orders`.

## Verification checklist

- `GET /health` → ok
- Seed: categories/products visible via `GET /categories`, `/products/popular`;
  product images resolve to Supabase Storage URLs.
- Mobile: login (email + Google) → browse → cart → `POST /orders` (price
  recomputed server-side; configurable 200×220 ⇒ 4 100 € once coefs confirmed) →
  order shows in history → request quote → message a conversation.
- Admin: Supabase login → product CRUD with image upload → order status/ship →
  quote send → campaign send (push arrives on a registered device) → dashboard
  KPIs reflect the seeded + new data.
- `get_advisors` (security + performance) clean after migrations.
