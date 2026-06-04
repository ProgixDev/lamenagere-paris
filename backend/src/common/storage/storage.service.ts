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

/**
 * Thin wrapper over Supabase Storage (bucket from SUPABASE_STORAGE_BUCKET).
 * All uploads are organized under top-level folders (products/, quotes/, ...).
 */
@Injectable()
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Uploads a buffer and returns its storage path + public URL. */
  async upload(
    folder: MediaFolder,
    filename: string,
    body: Buffer | Uint8Array,
    contentType: string,
    upsert = false,
  ): Promise<UploadResult> {
    const path = `${folder}/${filename}`;
    const { error } = await this.supabase.storage.upload(path, body, {
      contentType,
      upsert,
    });
    if (error) {
      throw new InternalServerErrorException(
        `Échec du téléversement: ${error.message}`,
      );
    }
    return { path, url: this.getPublicUrl(path) };
  }

  getPublicUrl(path: string): string {
    return this.supabase.storage.getPublicUrl(path).data.publicUrl;
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.supabase.storage.remove(paths);
    if (error) {
      throw new InternalServerErrorException(
        `Échec de la suppression: ${error.message}`,
      );
    }
  }
}
