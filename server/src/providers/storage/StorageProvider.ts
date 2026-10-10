/**
 * Where user-uploaded files live. V1 stores them on local disk; an
 * S3-compatible provider can implement the same interface for production.
 */
export interface StoredFile {
  /** Provider-relative key, e.g. "avatars/0b9f….webp". */
  key: string;
  /** URL path the browser loads, e.g. "/uploads/avatars/0b9f….webp". */
  url: string;
}

export interface StorageProvider {
  save(folder: 'avatars' | 'logos', data: Buffer, extension: 'webp'): Promise<StoredFile>;
  /** Deletes by URL previously returned from `save`. Unknown URLs are ignored. */
  remove(url: string): Promise<void>;
}
