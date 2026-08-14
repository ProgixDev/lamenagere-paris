/* eslint-disable no-console */
/**
 * Catalogues everything already sitting in Supabase Storage into media_assets.
 *
 * The bucket predates the catalogue by 772 files, so without this the Gallery
 * would open empty and dedupe would only ever compare new uploads against other
 * new uploads — the accessory PNGs that are re-uploaded today would keep
 * duplicating against the copies already stored.
 *
 * What it derives per file:
 *  - folder:    the product category that references it (via product_media ->
 *               products -> categories), else the usage type, else "Non classé"
 *  - kind:      from the storage prefix (products/, accessories/, ...)
 *  - auto_tags: category + product names that reference it, so search has
 *               something to match on — 656 of 706 product filenames are
 *               camera-roll numbers like "1000447529.jpg"
 *  - sha256:    hashed from the stored bytes, which is what lets a future
 *               upload of the same image be recognised and reused
 *
 * Run:  npm run backfill:media           (all files)
 *       npm run backfill:media -- --skip-hashes   (fast, no downloads)
 *
 * Idempotent: upserts on (bucket, path), and files already carrying a hash are
 * not re-downloaded, so an interrupted run can simply be repeated.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';

const UNSORTED = 'Non classé';

const KIND_BY_PREFIX: Record<string, string> = {
  products: 'product',
  accessories: 'accessory',
  categories: 'category',
  carousel: 'carousel',
  popups: 'popup',
  messages: 'message',
  quotes: 'quote',
};

/** Folder shown in the Gallery when nothing references the file. */
const FOLDER_BY_PREFIX: Record<string, string> = {
  categories: 'Catégories',
  carousel: 'Carrousel',
  popups: 'Pop-ups',
  messages: 'Messages clients',
  quotes: 'Devis',
};

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

interface StorageRow {
  name: string;
  bucket_id: string;
  size: number | null;
  mime: string | null;
}

/** Every object in storage, straight from the storage schema. */
async function listObjects(db: SupabaseClient): Promise<StorageRow[]> {
  const { data, error } = await db.rpc('media_backfill_objects');
  if (error) {
    throw new Error(
      `Impossible de lister les objets (${error.message}). ` +
        `Vérifiez que la fonction media_backfill_objects existe (migration 0034).`,
    );
  }
  return (data ?? []) as StorageRow[];
}

/**
 * url -> { folder, tags } for everything referenced by the catalogue.
 *
 * Only product media carries a natural folder (its category); the other
 * reference types fall back to their usage type.
 */
async function buildReferenceMap(db: SupabaseClient) {
  const map = new Map<string, { folder?: string; tags: Set<string> }>();

  const add = (url: string | null, folder?: string, ...tags: string[]) => {
    if (!url) return;
    const entry = map.get(url) ?? { tags: new Set<string>() };
    if (folder && !entry.folder) entry.folder = folder;
    for (const t of tags) if (t?.trim()) entry.tags.add(t.trim());
    map.set(url, entry);
  };

  const { data: media } = await db
    .from('product_media')
    .select('url, products(name, categories(name))');
  for (const row of media ?? []) {
    const product = (row as never as { products?: { name?: string; categories?: { name?: string } } }).products;
    const category = product?.categories?.name?.trim();
    add(row.url as string, category, category ?? '', product?.name ?? '');
  }

  const { data: cats } = await db
    .from('categories')
    .select('name, image_url, config_blocks');
  for (const c of cats ?? []) {
    add(c.image_url as string | null, 'Catégories', c.name as string);
    // Accessory / option art lives inside the config blocks, and is the media
    // most worth making findable — it's what gets re-uploaded today.
    for (const url of collectBlockImages(c.config_blocks)) {
      add(url, 'Accessoires', c.name as string);
    }
  }

  const { data: prods } = await db.from('products').select('name, config_blocks');
  for (const p of prods ?? []) {
    for (const url of collectBlockImages(p.config_blocks)) {
      add(url, 'Accessoires', p.name as string);
    }
  }

  const { data: slides } = await db.from('carousel_slides').select('media_url');
  for (const s of slides ?? []) add(s.media_url as string, 'Carrousel');

  const { data: popups } = await db.from('app_popups').select('image_url');
  for (const p of popups ?? []) add(p.image_url as string, 'Pop-ups');

  return map;
}

/**
 * Keys that hold an image URL inside a config block. `image` is accessory and
 * option art; `planImage` is the îlot photo and the plan/schéma. Keep in step
 * with config_block_images() in migration 0036 — the delete guard reads the
 * same set, and a key missing from either side becomes a silent hole.
 */
const IMAGE_KEYS = new Set(['image', 'planImage']);

/** Every image URL nested anywhere inside a config_blocks jsonb value. */
function collectBlockImages(blocks: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (IMAGE_KEYS.has(key) && typeof value === 'string') out.push(value);
        else walk(value);
      }
    }
  };
  walk(blocks);
  return out;
}

async function main() {
  loadEnv();
  const skipHashes = process.argv.includes('--skip-hashes');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
  }
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Lecture des objets du bucket…');
  const objects = await listObjects(db);
  console.log(`  ${objects.length} fichiers`);

  console.log('Lecture des références (produits, catégories, blocs de config)…');
  const refs = await buildReferenceMap(db);
  console.log(`  ${refs.size} URL référencées`);

  // Hashes we already computed, so a re-run doesn't download those files again.
  // These are carried into the upsert rather than skipped: every row writes a
  // sha256, so omitting it here would null out a hash we already paid for.
  const { data: known } = await db
    .from('media_assets')
    .select('path, sha256')
    .not('sha256', 'is', null);
  const existingHashes = new Map(
    (known ?? []).map((r) => [r.path as string, r.sha256 as string]),
  );

  let hashed = 0;
  let deduped = 0;
  const seenHashes = new Map<string, string>();
  const rows: Record<string, unknown>[] = [];

  for (const [i, obj] of objects.entries()) {
    const prefix = obj.name.split('/')[0];
    const publicUrl = db.storage.from(obj.bucket_id).getPublicUrl(obj.name).data
      .publicUrl;
    const ref = refs.get(publicUrl);

    let sha256: string | null = existingHashes.get(obj.name) ?? null;
    if (!skipHashes && !sha256) {
      const { data: blob, error } = await db.storage
        .from(obj.bucket_id)
        .download(obj.name);
      if (error) {
        console.warn(`  ! téléchargement impossible: ${obj.name} (${error.message})`);
      } else {
        const buf = Buffer.from(await blob.arrayBuffer());
        sha256 = createHash('sha256').update(buf).digest('hex');
        hashed++;
        if (seenHashes.has(sha256)) deduped++;
        else seenHashes.set(sha256, obj.name);
      }
    }

    const folder = ref?.folder ?? FOLDER_BY_PREFIX[prefix] ?? UNSORTED;

    rows.push({
      bucket: obj.bucket_id,
      path: obj.name,
      folder,
      // Accessory art physically lives under products/, so the prefix alone
      // would file it as a product photo and the picker's accessory filter
      // would miss it. What references the file wins over where it sits.
      kind: folder === 'Accessoires' ? 'accessory' : KIND_BY_PREFIX[prefix] ?? 'other',
      sha256,
      size: obj.size,
      mime: obj.mime,
      auto_tags: ref ? [...ref.tags] : [],
    });

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${objects.length}…`);
    }
  }

  console.log('Écriture du catalogue…');
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await db
      .from('media_assets')
      .upsert(chunk, { onConflict: 'bucket,path' });
    if (error) throw new Error(`Upsert échoué: ${error.message}`);
  }

  console.log(
    `\nTerminé. ${rows.length} fichiers catalogués, ${hashed} hachés, ` +
      `${deduped} doublons détectés.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
