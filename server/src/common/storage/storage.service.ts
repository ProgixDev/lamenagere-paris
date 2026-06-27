import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type MediaFolder =
  | 'products'
  | 'quotes'
  | 'messages'
  | 'categories'
  | 'carousel'
  | 'banners'
  | 'avatars';

export interface UploadResult {
  path: string;
  url: string;
}

export interface MediaItem {
  path: string;
  url: string;
  name: string;
  size?: number;
  createdAt?: string;
}

/** Dedicated public bucket holding category cover images. */
export const CATEGORY_IMAGE_BUCKET = 'category-images';

/**
 * Folders that live in their own bucket instead of the shared default bucket
 * (SUPABASE_STORAGE_BUCKET). Category covers get a dedicated bucket.
 */
const BUCKET_BY_FOLDER: Partial<Record<MediaFolder, string>> = {
  categories: CATEGORY_IMAGE_BUCKET,
};

/**
 * Thin wrapper over Supabase Storage. Most uploads land in the shared default
 * bucket under top-level folders (products/, quotes/, ...); a few folders
 * (see BUCKET_BY_FOLDER) are routed to their own dedicated bucket.
 */
@Injectable()
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Resolves the storage client for a given top-level folder. */
  private storageForFolder(folder: MediaFolder) {
    const bucket = BUCKET_BY_FOLDER[folder];
    return bucket ? this.supabase.storageBucket(bucket) : this.supabase.storage;
  }

  /** The folder a stored path belongs to (e.g. "categories/x.jpg" -> "categories"). */
  private folderOf(path: string): MediaFolder {
    return path.split('/')[0] as MediaFolder;
  }

  /** Uploads a buffer and returns its storage path + public URL. */
  async upload(
    folder: MediaFolder,
    filename: string,
    body: Buffer | Uint8Array,
    contentType: string,
    upsert = false,
  ): Promise<UploadResult> {
    const storage = this.storageForFolder(folder);
    const path = `${folder}/${filename}`;
    const { error } = await storage.upload(path, body, {
      contentType,
      upsert,
    });
    if (error) {
      throw new InternalServerErrorException(
        `Échec du téléversement: ${error.message}`,
      );
    }
    return { path, url: storage.getPublicUrl(path).data.publicUrl };
  }

  getPublicUrl(path: string): string {
    return this.storageForFolder(this.folderOf(path)).getPublicUrl(path).data
      .publicUrl;
  }

  /** Lists previously-uploaded files in a folder (newest first) for the media library. */
  async list(folder: MediaFolder, limit = 200): Promise<MediaItem[]> {
    const storage = this.storageForFolder(folder);
    const { data, error } = await storage.list(folder, {
      limit,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) {
      throw new InternalServerErrorException(
        `Échec du listage des médias: ${error.message}`,
      );
    }
    return (data ?? [])
      .filter((f) => f.id) // skip pseudo-folder entries (no id)
      .map((f) => {
        const path = `${folder}/${f.name}`;
        return {
          path,
          url: storage.getPublicUrl(path).data.publicUrl,
          name: f.name,
          size: (f.metadata?.size as number | undefined) ?? undefined,
          createdAt: f.created_at ?? undefined,
        };
      });
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    // Paths may span multiple buckets, so group by folder before removing.
    const byFolder = new Map<MediaFolder, string[]>();
    for (const path of paths) {
      const folder = this.folderOf(path);
      const list = byFolder.get(folder) ?? [];
      list.push(path);
      byFolder.set(folder, list);
    }
    for (const [folder, group] of byFolder) {
      const { error } = await this.storageForFolder(folder).remove(group);
      if (error) {
        throw new InternalServerErrorException(
          `Échec de la suppression: ${error.message}`,
        );
      }
    }
  }
}
