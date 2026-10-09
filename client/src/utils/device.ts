const STORAGE_KEY = 'device-id';
let memoryId: string | undefined;

/**
 * Random per-install identifier, sent as `X-Device-Id` so the server can warn
 * about sign-ins from new devices. Not a credential. Falls back to an
 * in-memory ID when storage is unavailable (private mode, blocked storage).
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}
