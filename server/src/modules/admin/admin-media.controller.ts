import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Roles } from '../../common/auth/roles.decorator';
import {
  MediaFolder,
  StorageService,
} from '../../common/storage/storage.service';

const ALLOWED: MediaFolder[] = [
  'products',
  'quotes',
  'messages',
  'categories',
  'carousel',
  'banners',
  'avatars',
];

function resolveFolder(raw?: string): MediaFolder {
  return ALLOWED.includes(raw as MediaFolder)
    ? (raw as MediaFolder)
    : 'products';
}

/** Admin media library backed by Supabase Storage. */
@Roles('admin', 'super_admin', 'editor')
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly storage: StorageService) {}

  /** Browse previously-uploaded files in a folder (for the picker). */
  @Get()
  list(@Query('folder') folderRaw?: string) {
    return this.storage.list(resolveFolder(folderRaw));
  }

  @Post()
  async upload(
    @Req() req: FastifyRequest,
    @Query('folder') folderRaw?: string,
  ) {
    const folder = resolveFolder(folderRaw);

    const file = await req.file();
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const buffer = await file.toBuffer();
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;

    const result = await this.storage.upload(
      folder,
      unique,
      buffer,
      file.mimetype,
    );
    return { url: result.url, path: result.path };
  }

  /** Delete a file from the library by its storage path. */
  @Delete()
  async remove(@Body('path') path?: string) {
    if (!path) throw new BadRequestException('Chemin du fichier requis');
    await this.storage.remove([path]);
    return { ok: true };
  }
}
