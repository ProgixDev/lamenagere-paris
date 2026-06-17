# La Ménagère Paris — Backend

NestJS + Fastify API on Supabase (Postgres + Auth + Storage), serving both the
Expo mobile app and the Next.js super-admin from one query layer.

See the full design in `../../.claude/plans/i-want-you-to-indexed-lamport.md`.

## Stack

- **NestJS 11** on the **Fastify** adapter
- **Supabase**: Postgres, Auth (GoTrue), Storage (`media` bucket)
- Auth: NestJS validates Supabase JWTs (`AuthGuard`); `profiles.role` gates admin
  routes (`RolesGuard`). Service-role client is the authorization source of truth;
  RLS is defense-in-depth.
- Money stored as **integer cents**; euro display strings produced only in
  serializers.

## Setup

```bash
cd backend
cp .env.example .env       # fill SUPABASE_* values
npm install
npm run start:dev          # http://localhost:3000  (GET /health)
```

### Required env

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (Project
Settings → API). Push/OAuth secrets are optional until those iterations.

## Deploy to Vercel (serverless)

The app runs as a Vercel serverless function via `api/index.ts`, which forwards
requests to the Fastify instance booted by `src/serverless.ts` (compiled to
`dist/`). Config: `vercel.json` (build = `npm run build`, all routes rewritten
to the function).

1. New Vercel project → **Root Directory = `backend`**.
2. Framework preset: **Other** (no framework). Build command is taken from
   `vercel.json`; leave Output Directory empty.
3. Set Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (required), plus any optional ones (`SUPABASE_ANON_KEY`,
   `SUPABASE_STORAGE_BUCKET`, `FIREBASE_SERVICE_ACCOUNT_JSON`, Google/APNs).
   `PORT` is NOT needed (serverless).
4. Deploy. Health check: `https://<deployment>/health`.

**Serverless caveats:** request body is capped (~4.5 MB Hobby), so large video
uploads should go **client → Supabase Storage** directly rather than through
`/admin/media`. For unlimited uploads / always-warm instances, deploy to a Node
host instead (`node dist/main.js`, e.g. Railway/Render) — both entrypoints
(`main.ts` for Node, `api/index.ts` for Vercel) share the same app.

## Database migrations

SQL lives in `supabase/migrations/`. Apply via the Supabase MCP
(`apply_migration`) or the Supabase CLI against project `trpluywvtaecvarrzugp`.
Iteration 1: `0001_init_auth.sql` (enums, profiles, addresses, auth trigger,
order counters, RLS scaffold).

## Scripts

- `npm run build` — compile to `dist/`
- `npm run start:dev` — watch mode
- `npm test` — unit tests
- `npm run seed` — populate the DB from both apps' mock data (added in Iter 3+)

## Layout

```
src/
  main.ts                 Fastify bootstrap, multipart, CORS, global pipe/filter
  app.module.ts           ConfigModule + global guards + feature modules
  config/                 env validation (zod)
  common/
    supabase/             @Global service-role client
    auth/                 AuthGuard, RolesGuard, @Roles/@CurrentUser/@Public
    storage/              StorageService (media bucket)
    pricing/              PricingService (fixed/calculated/quote)
    serialization/        money, initials, status labels, pagination
    filters/              { message, status } exception filter
  modules/                feature modules (added per iteration)
```
