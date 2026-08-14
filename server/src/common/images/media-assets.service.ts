import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MediaFolder,
  StorageService,
  UploadResult,
} from '../storage/storage.service';
import { ImagesService } from './images.service';

/** Where a folder-less asset lands until someone files it in the Gallery. */
export const UNSORTED_FOLDER = 'Non classé';

/** Which `kind` an upload folder implies, for the Gallery's filters. */
const KIND_BY_FOLDER: Record<MediaFolder, string> = {
  products: 'product',
  accessories: 'accessory',
  categories: 'category',
  carousel: 'carousel',
  popups: 'popup',
  messages: 'message',
  quotes: 'quote',
  banners: 'other',
  avatars: 'other',
};

export interface StoreOptions {
  folder: MediaFolder;
  filename: string;
  buffer: Buffer;
  mime: string;
  /** Logical Gallery folder. Defaults to UNSORTED_FOLDER. */
  galleryFolder?: string;
}

export interface StoredAsset extends UploadResult {
  /** True when an identical file already existed and was reused. */
  deduped: boolean;
}

/**
 * Owns the write path for every upload: compress, look for bytes we already
 * store, and keep `media_assets` in step with the bucket.
 *
 * Both upload endpoints funnel through `store()` so compression and dedupe
 * can't drift apart between the admin library and the app's own uploads.
 */
@Injectable()
export class MediaAssetsService {
  private readonly logger = new Logger(MediaAssetsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
    private readonly images: ImagesService,
  ) {}

  private get table() {
    return this.supabase.client.from('media_assets');
  }

  /**
   * Compresses, dedupes and stores an upload.
   *
   * On a content-hash hit the existing object is returned as-is and nothing new
   * is written — this is what stops the same accessory PNG being uploaded once
   * per product.
   */
  async store({
    folder,
    filename,
    buffer,
    mime,
    galleryFolder,
  }: StoreOptions): Promise<StoredAsset> {
    const processed = await this.images.process(buffer, mime);

    const existing = await this.findByHash(processed.sha256);
    if (existing) {
      this.logger.log(`Dédupliqué: ${filename} -> ${existing.path}`);
      return {
        path: existing.path,
        url: this.storage.getPublicUrl(existing.path),
        deduped: true,
      };
    }

    // Compression rewrites the container, so the stored name has to follow it —
    // a recompressed .png holding JPEG bytes would confuse every consumer.
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = processed.recompressed
      ? `${safeName.replace(/\.[^.]+$/, '')}.${processed.ext}`
      : safeName;
    const unique = `${Date.now()}_${finalName}`;

    const result = await this.storage.upload(
      folder,
      unique,
      processed.buffer,
      processed.mime,
    );

    await this.record({
      path: result.path,
      folder: galleryFolder ?? UNSORTED_FOLDER,
      kind: KIND_BY_FOLDER[folder] ?? 'other',
      sha256: processed.sha256,
      size: processed.buffer.length,
      mime: processed.mime,
      width: processed.width,
      height: processed.height,
    });

    return { ...result, deduped: false };
  }

  /** Live (non-deleted) asset with these exact bytes, if we already hold it. */
  private async findByHash(sha256: string) {
    const { data, error } = await this.table
      .select('path')
      .eq('sha256', sha256)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (error) {
      // The catalogue is an optimisation, never a gate: if the lookup fails we
      // simply store another copy rather than failing the upload.
      this.logger.warn(`Recherche de doublon impossible: ${error.message}`);
      return null;
    }
    return data;
  }

  private async record(row: {
    path: string;
    folder: string;
    kind: string;
    sha256: string;
    size: number;
    mime: string;
    width?: number;
    height?: number;
  }) {
    const bucket = this.storage.bucketForPath(row.path);
    const { error } = await this.table.upsert(
      { bucket, ...row },
      { onConflict: 'bucket,path' },
    );
    if (error) {
      this.logger.warn(`Indexation du média impossible: ${error.message}`);
    }
  }
}
