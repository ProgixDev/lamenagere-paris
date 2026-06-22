import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { StorageService } from '../../common/storage/storage.service';

/**
 * Authenticated media upload for end users (e.g. attaching photos/videos to a
 * conversation). Always lands in the `messages` folder of the shared bucket.
 * Protected by the global AuthGuard — any signed-in user may call it.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  async upload(@Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const buffer = await file.toBuffer();
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;

    const result = await this.storage.upload(
      'messages',
      unique,
      buffer,
      file.mimetype,
    );
    const type = file.mimetype.startsWith('video') ? 'video' : 'image';
    return { url: result.url, path: result.path, type };
  }
}
