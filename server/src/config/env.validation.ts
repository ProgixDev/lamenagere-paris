import { z } from 'zod';

/**
 * Runtime validation of process.env. Fails fast on boot if required
 * configuration is missing. Push/OAuth secrets are optional until the
 * iterations that need them are wired up.
 */
const envSchema = z.object({
  // Optional — provided by the hosting platform; not required to deploy.
  PORT: z.coerce.number().optional(),

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

  // Stripe (online payments). Secret key is required because PaymentsService
  // initializes the Stripe client at boot. Webhook secret is optional until
  // the webhook endpoint is registered in the Stripe dashboard.
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
