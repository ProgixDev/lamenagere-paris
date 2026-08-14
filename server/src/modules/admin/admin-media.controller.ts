import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
// Side-effect import: adds `req.file()` to FastifyRequest (see uploads.controller).
import '@fastify/multipart';
import { Roles } from '../../common/auth/roles.decorator';
import { MediaFolder } from '../../common/storage/storage.service';
import { MediaAssetsService } from '../../common/images/media-assets.service';
import { AdminMediaService } from './admin-media.service';

const ALLOWED: MediaFolder[] = [
  'products',
  'accessories',
  'quotes',
  'messages',
  'categories',
  'carousel',
  'banners',
  'popups',
  'avatars',
];

/**
 * An absent folder means "the default"; an explicitly wrong one is a caller
 * bug worth surfacing, rather than silently filing the upload under products/.
 */
function resolveStorageFolder(raw?: string): MediaFolder {
  if (!raw) return 'products';
  if (!ALLOWED.includes(raw as MediaFolder)) {
    throw new BadRequestException(`Dossier inconnu: ${raw}`);
  }
  return raw as MediaFolder;
}

/**
 * Admin media Gallery.
 *
 * Two different notions of "folder" meet on this route, so the query params are
 * named apart deliberately:
 *  - POST `?folder=` is the STORAGE prefix (products/, accessories/, …), which
 *    decides the bucket and path an upload physically lands in;
 *  - GET `?folder=` is the GALLERY folder, a free-form label the manager
 *    organises by. It never touches a storage path, which is what makes
 *    reorganising safe.
 */
@Roles('admin', 'super_admin', 'editor')
@Controller('admin/media')
export class AdminMediaController {
  constructor(
    private readonly media: MediaAssetsService,
    private readonly gallery: AdminMediaService,
  ) {}

  // Declared before any `:id` route so "folders" isn't swallowed as an id.
  @Get('folders')
  folders() {
    return this.gallery.folders();
  }

  @Post('folders')
  createFolder(@Body('name') name?: string) {
    return this.gallery.createFolder(name ?? '');
  }

  /** Paginated, searchable browse for the Gallery and the picker. */
  @Get()
  list(
    @Query('folder') folder?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gallery.list({
      folder: folder?.trim() || undefined,
      kind: kind?.trim() || undefined,
      q: q?.trim() || undefined,
      page: Number(page) || 1,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  async upload(
    @Req() req: FastifyRequest,
    @Query('folder') folderRaw?: string,
    @Query('galleryFolder') galleryFolder?: string,
  ) {
    const folder = resolveStorageFolder(folderRaw);

    const file = await req.file();
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const result = await this.media.store({
      folder,
      filename: file.filename,
      buffer: await file.toBuffer(),
      mime: file.mimetype,
      galleryFolder: galleryFolder?.trim() || undefined,
    });
    return { url: result.url, path: result.path, deduped: result.deduped };
  }

  /** Bulk move between gallery folders. Only a column changes. */
  @Post('move')
  move(@Body('ids') ids: string[], @Body('folder') folder?: string) {
    return this.gallery.move(ids ?? [], folder ?? '');
  }

  /** What still points at this asset — shown before offering to delete it. */
  @Get(':id/usage')
  usage(@Param('id') id: string) {
    return this.gallery.usage(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body('folder') folder?: string,
    @Body('label') label?: string,
  ) {
    return this.gallery.update(id, { folder, label });
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.gallery.restore(id);
  }

  /**
   * Soft delete. Refused (409) while anything still references the asset, and
   * the storage object is kept either way — see AdminMediaService.remove.
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gallery.remove(id);
  }

  /**
   * Legacy path-keyed delete, kept for older admin builds. Delegates to the
   * same reference-checked soft delete rather than the old unguarded
   * storage.remove(), which could silently break a live product.
   */
  @Delete()
  async removeByPath(@Body('path') path?: string) {
    if (!path) throw new BadRequestException('Chemin du fichier requis');
    return this.gallery.remove(await this.gallery.idForPath(path));
  }
}
