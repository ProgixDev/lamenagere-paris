import { z } from 'zod';

/**
 * Runtime validation of process.env. Fails fast on boot if required
 * configuration is missing. Push/OAuth secrets are optional until the
 * iterations that need them are wired up.
 */
const envSchema = z.object({
  // Optional — provided by the hosting platform; not required to deploy.
  PORT: z.coerce.number().optional(),

  // Which tier this process is: `development` (local machine or a Vercel
  // preview deploy, Stripe test mode) or `production` (the Vercel production
  // deploy, Stripe live mode). It exists so the guard below can refuse a live
  // Stripe key on a dev box. NODE_ENV is useless for this — Vercel sets it to
  // `production` on preview builds too.
  //
  // Left unset it is derived from Vercel's own VERCEL_ENV (see defaultAppEnv),
  // so the production deploy needs no manual variable and every other context
  // lands on the safe tier. Set it explicitly only to override that.
  APP_ENV: z.enum(['development', 'production']).optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('media'),

  GOOGLE_OAUTH_WEB_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_IOS_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_ANDROID_CLIENT_ID: z.string().optional().default(''),

  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  EXPO_ACCESS_TOKEN: z.string().optional().default(''),
  APNS_KEY_P8: z.string().optional().default(''),
  APNS_KEY_ID: z.string().optional().default(''),
  APNS_TEAM_ID: z.string().optional().default(''),
  APNS_BUNDLE_ID: z.string().optional().default('fr.lamenagereparis.app'),

  // Sign in with Apple. Only needed to revoke a user's Apple token when they
  // delete their account (required by Apple when both features are offered).
  // Left empty, sign-in still works and revocation is skipped with a warning.
  // KEY_P8 is the contents of the AuthKey_<KEY_ID>.p8 file (PEM, newlines may
  // be escaped as \n); CLIENT_ID is the app's bundle identifier.
  APPLE_SIGNIN_KEY_P8: z.string().optional().default(''),
  APPLE_SIGNIN_KEY_ID: z.string().optional().default(''),
  APPLE_SIGNIN_TEAM_ID: z.string().optional().default(''),
  APPLE_SIGNIN_CLIENT_ID: z
    .string()
    .optional()
    .default('com.progix.lamenagereparis'),

  // Stripe (online payments). Secret key is required because PaymentsService
  // initializes the Stripe client at boot. Webhook secret is optional until
  // the webhook endpoint is registered in the Stripe dashboard.
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),

  // Shared secret guarding the website-brief owner console (/briefs?k=…).
  // Left empty, the owner routes refuse every request.
  BRIEF_OWNER_KEY: z.string().optional().default(''),

  // Outbound mail (the facture emailed to the customer at checkout).
  // Optional so the server still boots without it, but a deployment missing
  // these silently stops delivering factures — main.ts logs the state on boot
  // and InvoicesService writes `smtp_not_configured` into invoices.email_error.
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_SECURE: z.string().optional().default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
});

/**
 * The tier to assume when APP_ENV is not set explicitly.
 *
 * Vercel injects VERCEL_ENV on every deployment: `production` for the
 * production deploy, `preview` for branch/PR deploys, `development` for
 * `vercel dev`. Only the first is the money-moving tier. Anything else —
 * including a plain laptop, where VERCEL_ENV is absent entirely — is
 * development, so the *safe* tier is what you get by forgetting.
 */
function defaultAppEnv(config: Record<string, unknown>): 'development' | 'production' {
  return config.VERCEL_ENV === 'production' ? 'production' : 'development';
}

/**
 * Stripe keys carry their own tier in the prefix (`sk_test_` / `sk_live_`),
 * so a mismatch with APP_ENV is always a configuration mistake — and the
 * expensive direction (live key on a developer's machine) charges real cards
 * from a laptop. Both directions fail the boot rather than warn: a warning in
 * a scrollback is exactly what got missed the last time.
 */
function assertStripeTierMatches(env: {
  APP_ENV: 'development' | 'production';
  STRIPE_SECRET_KEY: string;
}): string | null {
  const isLiveKey = env.STRIPE_SECRET_KEY.startsWith('sk_live_');
  const isTestKey = env.STRIPE_SECRET_KEY.startsWith('sk_test_');

  if (env.APP_ENV === 'development' && isLiveKey) {
    return (
      'APP_ENV=development but STRIPE_SECRET_KEY is a LIVE key (sk_live_…). ' +
      'This would charge real cards from a development machine. Use the ' +
      'test-mode key (Stripe Dashboard → toggle "Test mode" → API keys), ' +
      'or set APP_ENV=production if this really is the production deploy.'
    );
  }
  if (env.APP_ENV === 'production' && isTestKey) {
    return (
      'APP_ENV=production but STRIPE_SECRET_KEY is a TEST key (sk_test_…). ' +
      'Real customers would get a payment sheet that never takes money. Set ' +
      'the live key in the Vercel Production environment.'
    );
  }
  return null;
}

// APP_ENV is optional in the schema but always resolved by validateEnv, so
// consumers see a concrete tier rather than `undefined`.
export type Env = Omit<z.infer<typeof envSchema>, 'APP_ENV'> & {
  APP_ENV: 'development' | 'production';
};

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const resolved = {
    ...parsed.data,
    APP_ENV: parsed.data.APP_ENV ?? defaultAppEnv(config),
  };

  const mismatch = assertStripeTierMatches(resolved);
  if (mismatch) throw new Error(`Invalid environment configuration:\n  - ${mismatch}`);

  return resolved;
}
