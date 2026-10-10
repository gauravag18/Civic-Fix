import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveIssueImagePath, type PreparedIssueImage } from "@/lib/issues/image-rules";

export function issueImageDirectory(): string {
  const configured = process.env.ISSUE_IMAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "data", "issue-images");
}

export async function saveIssueImages(
  images: PreparedIssueImage[],
  root = issueImageDirectory(),
): Promise<boolean> {
  const written: string[] = [];
  try {
    await mkdir(root, { recursive: true });
    for (const image of images) {
      const full = resolveIssueImagePath(root, image.storageKey);
      if (!full) throw new Error("unsafe image key");
      await writeFile(full, image.bytes, { flag: "wx" });
      written.push(image.storageKey);
    }
    return true;
  } catch {
    await removeIssueImages(written, root);
    return false;
  }
}

export async function removeIssueImages(keys: string[], root = issueImageDirectory()): Promise<void> {
  for (const key of keys) {
    const full = resolveIssueImagePath(root, key);
    if (!full) continue;
    await unlink(full).catch(() => undefined);
  }
}

export async function readIssueImage(
  key: string,
  root = issueImageDirectory(),
): Promise<Uint8Array | null> {
  const full = resolveIssueImagePath(root, key);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}
