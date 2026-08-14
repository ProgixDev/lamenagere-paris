import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  buildPaginated,
  clampLimit,
  pageRange,
  PaginatedResponse,
} from '../../common/serialization/pagination';

export interface GalleryAsset {
  id: string;
  path: string;
  url: string;
  folder: string;
  label: string | null;
  kind: string;
  size: number | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  autoTags: string[];
  createdAt: string;
}

export interface GalleryFolder {
  name: string;
  count: number;
  size: number;
}

export interface UsageEntry {
  source: string;
  label: string;
}

interface AssetRow {
  id: string;
  path: string;
  folder: string;
  label: string | null;
  kind: string;
  size: number | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  auto_tags: string[] | null;
  created_at: string;
}

/**
 * Read/organise side of the admin Gallery. The write side (compress, dedupe,
 * index) lives in MediaAssetsService, which both upload endpoints share.
 *
 * Everything here operates on `media_assets` rows, never on storage paths:
 * moving an asset between folders is a column update, so reorganising the
 * library can't invalidate a URL that a product, category, carousel slide or
 * config block has already stored.
 */
@Injectable()
export class AdminMediaService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
  ) {}

  private get assets() {
    return this.supabase.client.from('media_assets');
  }

  private toDto = (row: AssetRow): GalleryAsset => ({
    id: row.id,
    path: row.path,
    url: this.storage.getPublicUrl(row.path),
    folder: row.folder,
    label: row.label,
    kind: row.kind,
    size: row.size,
    mime: row.mime,
    width: row.width,
    height: row.height,
    autoTags: row.auto_tags ?? [],
    createdAt: row.created_at,
  });

  /** Folders with their live asset counts, for the Gallery sidebar. */
  async folders(): Promise<GalleryFolder[]> {
    const { data: names } = await this.supabase.client
      .from('media_folders')
      .select('name')
      .order('name');

    // Counts come from the assets themselves so an emptied folder still shows,
    // correctly, as 0 rather than disappearing.
    const { data: rows } = await this.assets
      .select('folder, size')
      .is('deleted_at', null);

    const stats = new Map<string, { count: number; size: number }>();
    for (const row of (rows ?? []) as { folder: string; size: number | null }[]) {
      const entry = stats.get(row.folder) ?? { count: 0, size: 0 };
      entry.count += 1;
      entry.size += row.size ?? 0;
      stats.set(row.folder, entry);
    }

    const known = new Set((names ?? []).map((f) => f.name as string));
    // A folder that only exists on assets (e.g. created by a backfill after the
    // seed) should still be listed rather than silently hiding its contents.
    for (const folder of stats.keys()) known.add(folder);

    return [...known].sort((a, b) => a.localeCompare(b, 'fr')).map((name) => ({
      name,
      count: stats.get(name)?.count ?? 0,
      size: stats.get(name)?.size ?? 0,
    }));
  }

  async createFolder(name: string): Promise<GalleryFolder> {
    const clean = name.trim();
    if (!clean) throw new BadRequestException('Nom de dossier requis');

    const { error } = await this.supabase.client
      .from('media_folders')
      .insert({ name: clean });
    if (error) {
      // 23505 = unique_violation
      if (error.code === '23505') {
        throw new ConflictException(`Le dossier « ${clean} » existe déjà`);
      }
      throw new BadRequestException(
        `Création du dossier impossible: ${error.message}`,
      );
    }
    return { name: clean, count: 0, size: 0 };
  }

  /** Paginated, searchable listing. */
  async list(opts: {
    folder?: string;
    kind?: string;
    q?: string;
    page: number;
    limit?: number;
  }): Promise<PaginatedResponse<GalleryAsset>> {
    const limit = clampLimit(opts.limit ?? 60, 60);
    const { from, to } = pageRange(opts.page, limit);

    let query = this.assets
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (opts.folder) query = query.eq('folder', opts.folder);
    if (opts.kind) query = query.eq('kind', opts.kind);

    const term = opts.q?.trim();
    if (term) {
      // Label is what the manager typed; path covers the original filename;
      // auto_tags carries the category/product names the backfill derived —
      // which is the only handle on the 656 files named like "1000447529.jpg".
      const escaped = term.replace(/[%,()]/g, ' ');
      query = query.or(
        `label.ilike.%${escaped}%,path.ilike.%${escaped}%,auto_tags.cs.{"${escaped}"}`,
      );
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throw new BadRequestException(`Listage impossible: ${error.message}`);
    }

    const items = ((data ?? []) as AssetRow[]).map(this.toDto);
    return buildPaginated(items, count ?? items.length, opts.page, limit);
  }

  /** Everything currently referencing this asset's public URL. */
  async usage(id: string): Promise<UsageEntry[]> {
    const asset = await this.byId(id);
    const { data, error } = await this.supabase.client.rpc('media_usage', {
      p_url: this.storage.getPublicUrl(asset.path),
    });
    if (error) {
      throw new BadRequestException(
        `Vérification des usages impossible: ${error.message}`,
      );
    }
    return (data ?? []) as UsageEntry[];
  }

  async update(
    id: string,
    patch: { folder?: string; label?: string },
  ): Promise<GalleryAsset> {
    await this.byId(id);

    const changes: Record<string, unknown> = {};
    if (patch.folder !== undefined) {
      const folder = patch.folder.trim();
      if (!folder) throw new BadRequestException('Dossier invalide');
      await this.ensureFolder(folder);
      changes.folder = folder;
    }
    if (patch.label !== undefined) changes.label = patch.label.trim() || null;

    if (Object.keys(changes).length === 0) return this.get(id);

    const { data, error } = await this.assets
      .update(changes)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new BadRequestException(`Mise à jour impossible: ${error.message}`);
    }
    return this.toDto(data as AssetRow);
  }

  /** Bulk move. Non-destructive by construction — only the folder column moves. */
  async move(ids: string[], folder: string): Promise<{ moved: number }> {
    if (!ids?.length) throw new BadRequestException('Aucun média sélectionné');
    const clean = folder.trim();
    if (!clean) throw new BadRequestException('Dossier invalide');
    await this.ensureFolder(clean);

    const { data, error } = await this.assets
      .update({ folder: clean })
      .in('id', ids)
      .is('deleted_at', null)
      .select('id');
    if (error) {
      throw new BadRequestException(`Déplacement impossible: ${error.message}`);
    }
    return { moved: (data ?? []).length };
  }

  /**
   * Soft delete, refused while anything still points at the asset.
   *
   * The storage object is deliberately left in place: every consumer stores the
   * public URL verbatim, so removing bytes is irreversible breakage, while a
   * flagged row can be restored in one click.
   */
  async remove(id: string): Promise<{ ok: true }> {
    const used = await this.usage(id);
    if (used.length > 0) {
      const detail = used
        .slice(0, 5)
        .map((u) => `${u.source}: ${u.label}`)
        .join(', ');
      const more = used.length > 5 ? ` (+${used.length - 5} autres)` : '';
      throw new ConflictException(
        `Ce média est encore utilisé — ${detail}${more}. Retirez-le de ces emplacements avant de le supprimer.`,
      );
    }

    const { error } = await this.assets
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new BadRequestException(`Suppression impossible: ${error.message}`);
    }
    return { ok: true };
  }

  async restore(id: string): Promise<GalleryAsset> {
    const { data, error } = await this.assets
      .update({ deleted_at: null })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException('Média introuvable');
    }
    return this.toDto(data as AssetRow);
  }

  /** Resolves a legacy storage path to its catalogue id. */
  async idForPath(path: string): Promise<string> {
    const { data, error } = await this.assets
      .select('id')
      .eq('path', path)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Média introuvable');
    return data.id as string;
  }

  async get(id: string): Promise<GalleryAsset> {
    return this.toDto(await this.byId(id));
  }

  private async byId(id: string): Promise<AssetRow> {
    const { data, error } = await this.assets
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Média introuvable');
    return data as AssetRow;
  }

  /** Folders are free-form; creating on demand keeps a move from failing. */
  private async ensureFolder(name: string): Promise<void> {
    await this.supabase.client
      .from('media_folders')
      .upsert({ name }, { onConflict: 'name' });
  }
}
