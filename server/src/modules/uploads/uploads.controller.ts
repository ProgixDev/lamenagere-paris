import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
// Side-effect import: this is what adds `req.file()` to FastifyRequest. Without
// it the call only typechecks when something else in the graph happens to pull
// the augmentation in.
import '@fastify/multipart';
import { MediaAssetsService } from '../../common/images/media-assets.service';

/**
 * Authenticated media upload for end users (e.g. attaching photos/videos to a
 * conversation). Always lands in the `messages` folder of the shared bucket.
 * Protected by the global AuthGuard — any signed-in user may call it.
 *
 * The app already compresses images before sending them; going through
 * MediaAssetsService keeps that honest for older app builds and indexes the
 * upload so the admin Gallery can see it.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly media: MediaAssetsService) {}

  @Post()
  async upload(@Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const result = await this.media.store({
      folder: 'messages',
      filename: file.filename,
      buffer: await file.toBuffer(),
      mime: file.mimetype,
    });

    const type = file.mimetype.startsWith('video') ? 'video' : 'image';
    return { url: result.url, path: result.path, type };
  }
}
