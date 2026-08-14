import { Global, Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { MediaAssetsService } from './media-assets.service';

/**
 * Compression + the media catalogue. Global, like StorageModule, because both
 * upload endpoints (admin library and end-user attachments) need it and neither
 * should be able to bypass it.
 */
@Global()
@Module({
  providers: [ImagesService, MediaAssetsService],
  exports: [ImagesService, MediaAssetsService],
})
export class ImagesModule {}
