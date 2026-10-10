import { isPersistableImage, isSafeStorageKey, type PreparedIssueImage } from "@/lib/issues/image-rules";

export type StoredObject = {
  key: string;
  bytes: Uint8Array;
  mimeType: string;
};

export type ObjectStore = {
  put(object: StoredObject): Promise<void>;
  remove(keys: string[]): Promise<void>;
  read(key: string): Promise<Uint8Array | null>;
};

export type StorageConfig = {
  url: string;
  secretKey: string;
  bucket: string;
};

const BUCKET = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function readStorageConfig(
  env: Record<string, string | undefined> = process.env,
): StorageConfig | null {
  const url = env.SUPABASE_URL?.trim() ?? "";
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() ?? "";
  const bucket = env.SUPABASE_STORAGE_BUCKET?.trim() ?? "";
  if (!url.startsWith("https://") || !secretKey || !BUCKET.test(bucket)) return null;
  return { url, secretKey, bucket };
}

/**
 * Writes each photograph, then deletes only the objects written in this call
 * if a later upload fails. A database rollback does not remove these objects;
 * the caller must delete them when the database write fails.
 */
export async function saveIssueImages(
  images: PreparedIssueImage[],
  store: ObjectStore | null,
): Promise<boolean> {
  if (!store) return false;
  const written: string[] = [];
  try {
    for (const image of images) {
      if (!isPersistableImage(image)) throw new Error("invalid image");
      await store.put({ key: image.storageKey, bytes: image.bytes, mimeType: image.mimeType });
      written.push(image.storageKey);
    }
    return true;
  } catch {
    if (written.length > 0) await store.remove(written).catch(() => undefined);
    return false;
  }
}

export async function removeIssueImages(keys: string[], store: ObjectStore | null): Promise<void> {
  if (!store) return;
  const safe = keys.filter(isSafeStorageKey);
  if (safe.length === 0) return;
  await store.remove(safe).catch(() => undefined);
}

export async function readIssueImage(key: string, store: ObjectStore | null): Promise<Uint8Array | null> {
  if (!store || !isSafeStorageKey(key)) return null;
  try {
    return await store.read(key);
  } catch {
    return null;
  }
}
