import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSafeStorageKey } from "@/lib/issues/image-rules";
import { readStorageConfig, type ObjectStore } from "@/lib/issues/image-storage";

export function createIssueImageStore(): ObjectStore | null {
  const config = readStorageConfig();
  if (!config) return null;
  const supabase = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const bucket = config.bucket;
  return {
    async put(object) {
      if (!isSafeStorageKey(object.key)) throw new Error("unsafe image key");
      const { error } = await supabase.storage.from(bucket).upload(object.key, Buffer.from(object.bytes), {
        contentType: object.mimeType,
        upsert: false,
      });
      if (error) throw new Error("upload failed");
    },
    async remove(keys) {
      const safe = keys.filter(isSafeStorageKey);
      if (safe.length === 0) return;
      const { error } = await supabase.storage.from(bucket).remove(safe);
      if (error) throw new Error("remove failed");
    },
    async read(key) {
      if (!isSafeStorageKey(key)) return null;
      const { data, error } = await supabase.storage.from(bucket).download(key);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
