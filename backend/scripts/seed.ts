/* eslint-disable no-console */
/**
 * Idempotent seed. Populates Supabase from the apps' mock data:
 *  - categories, products, product_media (uploading local asset images to
 *    Supabase Storage), featured_products
 *  - a super_admin profile (from ADMIN_EMAIL / ADMIN_PASSWORD)
 *
 * Run:  npm run seed     (requires backend/.env with SUPABASE_* values)
 *
 * Safe to re-run: upserts by slug, replaces media, re-uploads with upsert.
 * Customer/order/quote/messaging seed is added in later iterations.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  PRODUCT_IMAGE_FILES,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
} from './seed-data';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets', 'la menagere');
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  return 'image/jpeg';
}

async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log(`• created storage bucket "${BUCKET}"`);
  }
}

async function uploadImage(
  supabase: SupabaseClient,
  key: string,
  destName: string,
): Promise<string | null> {
  const file = PRODUCT_IMAGE_FILES[key];
  if (!file) {
    console.warn(`  ! unknown image key ${key}`);
    return null;
  }
  const src = path.join(ASSETS_DIR, file);
  if (!fs.existsSync(src)) {
    console.warn(`  ! missing asset ${src}`);
    return null;
  }
  const ext = path.extname(file);
  const storagePath = `products/${destName}${ext}`;
  const body = fs.readFileSync(src);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: contentType(file), upsert: true });
  if (error) {
    console.warn(`  ! upload failed for ${storagePath}: ${error.message}`);
    return null;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function seedCategories(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < SEED_CATEGORIES.length; i++) {
    const c = SEED_CATEGORIES[i];
    const { data, error } = await supabase
      .from('categories')
      .upsert(
        {
          slug: c.slug,
          name: c.name,
          icon: c.icon,
          accent_color: c.accentColor,
          description: c.description,
          sort_order: i,
          is_visible: true,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single<{ id: string }>();
    if (error || !data) throw new Error(`category ${c.slug}: ${error?.message}`);
    map.set(c.slug, data.id);
  }
  console.log(`• categories: ${map.size}`);
  return map;
}

async function seedProducts(
  supabase: SupabaseClient,
  categoryIds: Map<string, string>,
): Promise<void> {
  const featured: string[] = [];
  let n = 0;

  for (const p of SEED_PRODUCTS) {
    const categoryId = categoryIds.get(p.categorySlug);
    if (!categoryId) {
      console.warn(`  ! unknown category ${p.categorySlug} for ${p.slug}`);
      continue;
    }

    const priceCents = p.price != null ? Math.round(p.price * 100) : null;
    const { data: prod, error } = await supabase
      .from('products')
      .upsert(
        {
          slug: p.slug,
          sku: `LMP-${p.slug.toUpperCase()}`,
          name: p.name,
          description: p.description,
          category_id: categoryId,
          product_type: p.productType,
          price_mode: p.priceMode,
          status: 'publie',
          base_price_cents: priceCents,
          ref_width: p.dimensions?.width ?? null,
          ref_height: p.dimensions?.height ?? null,
          dim_width: p.dimensions?.width ?? null,
          dim_height: p.dimensions?.height ?? null,
          dim_depth: p.dimensions?.depth ?? null,
          customizable: p.customizable,
          delivery_metropole: p.deliveryEstimates.metropole,
          delivery_outremer: p.deliveryEstimates.outreMer,
          is_featured: p.featured ?? false,
          popularity: p.featured ? 100 : 50,
          published_at: new Date(p.createdAt).toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single<{ id: string }>();
    if (error || !prod) throw new Error(`product ${p.slug}: ${error?.message}`);

    // Replace media: upload images, then reset rows.
    await supabase.from('product_media').delete().eq('product_id', prod.id);
    for (let i = 0; i < p.imageKeys.length; i++) {
      const url = await uploadImage(supabase, p.imageKeys[i], `${p.slug}-${i}`);
      if (url) {
        await supabase.from('product_media').insert({
          product_id: prod.id,
          type: 'image',
          url,
          sort_order: i,
          is_primary: i === 0,
        });
      }
    }
    if (p.featured) featured.push(prod.id);
    n++;
  }
  console.log(`• products: ${n}`);

  // Featured products (ordered).
  await supabase.from('featured_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase
    .from('featured_products')
    .insert(featured.map((product_id, position) => ({ product_id, position })));
  console.log(`• featured_products: ${featured.length}`);
}

async function seedAdmin(supabase: SupabaseClient): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('• admin: skipped (set ADMIN_EMAIL / ADMIN_PASSWORD)');
    return;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Admin', last_name: 'La Ménagère' },
  });
  let userId = data?.user?.id;
  if (error && !userId) {
    // Likely already exists — look it up.
    const { data: list } = await supabase.auth.admin.listUsers();
    const users = (list?.users ?? []) as Array<{ id: string; email?: string }>;
    userId = users.find((u) => u.email === email)?.id;
  }
  if (userId) {
    await supabase
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', userId);
    console.log(`• admin: ${email} (super_admin)`);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Seeding La Ménagère Paris…');
  await ensureBucket(supabase);
  const categoryIds = await seedCategories(supabase);
  await seedProducts(supabase, categoryIds);
  await seedAdmin(supabase);
  console.log('✓ seed complete');
}

main().catch((err) => {
  console.error('✗ seed failed:', err);
  process.exit(1);
});
