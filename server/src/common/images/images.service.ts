import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

/**
 * Longest edge kept for a stored image, and the JPEG quality used to re-encode.
 *
 * 2000px is deliberately generous: product photos are the storefront and get
 * pinch-zoomed, and the app's gallery already renders ~1290px on a 3x phone.
 * The saving comes less from the resize than from the re-encode — 95 of the
 * files in the bucket are PNGs averaging 1.7 MB, i.e. photographs stored in a
 * lossless format.
 */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 82;

/**
 * Formats we deliberately pass through untouched:
 *  - SVG is vector; rasterising it would be a downgrade, and it's already tiny.
 *  - GIF may be animated, and sharp would flatten it to a single frame.
 *
 * HEIC is NOT in this list, but it fails to decode anyway and falls back via
 * the catch below. Don't spend time trying to fix that here: sharp's prebuilt
 * libvips declares only `.avif` as a HEIF input, and libheif rejects real
 * iPhone files with "Number of references in iref box (48) exceeds the security
 * limits of 16". `failOn: 'none'` and `unlimited: true` were both tried and
 * neither helps. iPhone HEIC is converted to JPEG on the device instead, in
 * features/messaging/upload.ts — that client-side step is load-bearing, not a
 * nicety, because the server genuinely cannot do it.
 */
const PASSTHROUGH = new Set(['image/svg+xml', 'image/gif']);

export interface ProcessedImage {
  buffer: Buffer;
  mime: string;
  /** Extension to use for the stored filename, without the dot. */
  ext: string;
  sha256: string;
  width?: number;
  height?: number;
  /** False when the bytes were passed through unchanged. */
  recompressed: boolean;
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  /** SHA-256 of a buffer, used to recognise bytes we already store. */
  hash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Downscales and re-encodes an uploaded image to JPEG.
   *
   * Anything that isn't a raster image we can safely rewrite — video, SVG,
   * animated GIF — comes back untouched, as does an image that sharp fails to
   * decode. A codec we can't read is not a reason to reject the upload.
   */
  async process(buffer: Buffer, mime: string): Promise<ProcessedImage> {
    const passthrough = (): ProcessedImage => ({
      buffer,
      mime,
      ext: mime.split('/')[1]?.split('+')[0] ?? 'bin',
      sha256: this.hash(buffer),
      recompressed: false,
    });

    if (!mime.startsWith('image/') || PASSTHROUGH.has(mime)) {
      return passthrough();
    }

    try {
      const processed = await sharp(buffer)
        // Applies the EXIF orientation flag and then drops it. Without this,
        // stripping metadata during the re-encode leaves portrait phone photos
        // rendering sideways.
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: 'inside',
          // Never blow a small image up to the cap.
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      // A small, already-optimised JPEG can come out bigger than it went in.
      // Keeping the original is both smaller and lossless in that case.
      if (processed.data.length >= buffer.length) {
        this.logger.debug(
          `Recompression grew ${mime} (${buffer.length} -> ${processed.data.length} bytes); keeping original`,
        );
        return passthrough();
      }

      return {
        buffer: processed.data,
        mime: 'image/jpeg',
        ext: 'jpg',
        sha256: this.hash(processed.data),
        width: processed.info.width,
        height: processed.info.height,
        recompressed: true,
      };
    } catch (error) {
      this.logger.warn(
        `Compression impossible (${mime}): ${(error as Error).message}`,
      );
      return passthrough();
    }
  }
}
