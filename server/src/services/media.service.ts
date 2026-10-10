import { ERROR_CODES } from '@app/shared';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { storage } from '../providers/storage/index.js';
import { AppError } from '../utils/AppError.js';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const OUTPUT_SIZE = 512;

const unsupported = () =>
  new AppError(ERROR_CODES.VALIDATION_ERROR, 'Upload a PNG, JPEG or WebP image.', 422, [
    { path: 'file', message: 'Upload a PNG, JPEG or WebP image.' },
  ]);

/**
 * Turns an untrusted upload into a safe, small, square WebP:
 *  • the real type is sniffed from the bytes (the client's MIME/extension are ignored);
 *  • SVG/HTML and anything else is refused (no script-carrying formats);
 *  • the image is fully decoded and re-encoded, which drops EXIF (GPS!) and
 *    neutralises polyglot files; decompression bombs are capped by pixel count.
 */
export async function storeImage(folder: 'avatars' | 'logos', data: Buffer): Promise<string> {
  const detected = await fileTypeFromBuffer(data);
  if (!detected || !ACCEPTED.has(detected.mime)) throw unsupported();

  let output: Buffer;
  try {
    output = await sharp(data, { failOn: 'error', limitInputPixels: 25_000_000 })
      .rotate() // respect camera orientation before metadata is dropped
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw unsupported();
  }
  return (await storage.save(folder, output, 'webp')).url;
}

export function removeImage(url: string | null | undefined): Promise<void> {
  return url ? storage.remove(url) : Promise.resolve();
}
