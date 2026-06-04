import {
  BadRequestException,
  Controller,
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

/** Admin media upload -> Supabase Storage. Returns the public URL. */
@Roles('admin', 'super_admin')
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  async upload(
    @Req() req: FastifyRequest,
    @Query('folder') folderRaw?: string,
  ) {
    const folder: MediaFolder = ALLOWED.includes(folderRaw as MediaFolder)
      ? (folderRaw as MediaFolder)
      : 'products';

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
}
