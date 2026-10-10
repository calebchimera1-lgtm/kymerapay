import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, StoredFile } from './StorageProvider.js';

export const UPLOADS_URL_PREFIX = '/uploads';

/** Stores files under `rootDir/<folder>/<uuid>.<ext>` with server-chosen names only. */
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async save(folder: 'avatars' | 'logos', data: Buffer, extension: 'webp'): Promise<StoredFile> {
    const key = `${folder}/${randomUUID()}.${extension}`;
    const target = path.join(this.rootDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
    return { key, url: `${UPLOADS_URL_PREFIX}/${key}` };
  }

  async remove(url: string): Promise<void> {
    // Only delete files we created: strict shape check prevents path traversal.
    const match = /^\/uploads\/(avatars|logos)\/([0-9a-f-]{36}\.webp)$/.exec(url);
    if (!match) return;
    await unlink(path.join(this.rootDir, match[1]!, match[2]!)).catch(() => undefined);
  }
}
