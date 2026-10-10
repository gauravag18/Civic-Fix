import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReadIssueImage, isSafeStorageKey, validateIssueImages } from "@/lib/issues/image-rules";
import {
  readIssueImage,
  readStorageConfig,
  removeIssueImages,
  removeStoredIssueImages,
  saveIssueImages,
  type ObjectStore,
} from "@/lib/issues/image-storage";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x01]);

class MemoryObjects implements ObjectStore {
  readonly objects = new Map<string, Uint8Array>();
  readonly removed: string[][] = [];
  failOnPut = 0;
  failOnRemove = false;
  puts = 0;

  async put(object: { key: string; bytes: Uint8Array; mimeType: string }): Promise<void> {
    this.puts += 1;
    if (this.puts === this.failOnPut) throw new Error("provider down");
    this.objects.set(object.key, object.bytes);
  }

  async remove(keys: string[]): Promise<void> {
    if (this.failOnRemove) throw new Error("remove failed");
    this.removed.push([...keys]);
    for (const key of keys) this.objects.delete(key);
  }

  async read(key: string): Promise<Uint8Array | null> {
    const value = this.objects.get(key);
    return value ? Uint8Array.from(value) : null;
  }
}

describe("issue image storage", () => {
  it("requires https, a secret, and a bucket name without accepting a public prefix", () => {
    assert.equal(readStorageConfig({}), null);
    assert.equal(
      readStorageConfig({
        SUPABASE_URL: "http://example.test",
        SUPABASE_SECRET_KEY: "test-secret",
        SUPABASE_STORAGE_BUCKET: "civicfix-issue-images",
      }),
      null,
    );
    const config = readStorageConfig({
      SUPABASE_URL: "https://example.test",
      SUPABASE_SECRET_KEY: "test-secret",
      SUPABASE_STORAGE_BUCKET: "civicfix-issue-images",
      NEXT_PUBLIC_SUPABASE_SECRET_KEY: "should-not-be-used",
    });
    assert.equal(config?.bucket, "civicfix-issue-images");
    assert.equal(config?.secretKey, "test-secret");
    assert.equal(JSON.stringify({ bucket: config?.bucket }).includes("test-secret"), false);
  });

  it("names objects from the validated bytes and cleans up a partial upload", async () => {
    const prepared = validateIssueImages([
      { bytes: jpeg, declaredName: "C:\\secret\\road.jpg" },
      { bytes: jpeg, declaredName: "lamp.jpg" },
    ]);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.match(prepared.images[0]?.storageKey ?? "", /^[0-9a-f-]{36}\.jpg$/);
    assert.equal(prepared.images[0]?.originalFilename, "road.jpg");
    assert.equal(isSafeStorageKey("../evil.jpg"), false);

    const missing = await saveIssueImages(prepared.images, null);
    assert.equal(missing, false);

    const store = new MemoryObjects();
    store.failOnPut = 2;
    assert.equal(await saveIssueImages(prepared.images, store), false);
    assert.equal(store.objects.size, 0);
    assert.deepEqual(store.removed, [[prepared.images[0]?.storageKey]]);

    const saved = new MemoryObjects();
    assert.equal(await saveIssueImages(prepared.images, saved), true);
    const key = prepared.images[0]?.storageKey ?? "";
    assert.deepEqual(await readIssueImage(key, saved), jpeg);
    assert.equal(await readIssueImage(`../${key}`, saved), null);
    await removeIssueImages([key, "../other.jpg"], saved);
    assert.equal(await readIssueImage(key, saved), null);
    assert.equal(saved.objects.has(prepared.images[1]?.storageKey ?? ""), true);
  });

  it("reports storage removal failure without dropping an unsafe key", async () => {
    const store = new MemoryObjects();
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";
    assert.equal(await removeStoredIssueImages([], store), true);
    assert.equal(await removeStoredIssueImages([key], null), false);
    assert.equal(await removeStoredIssueImages(["../secret.jpg"], store), false);
    store.failOnPut = 0;
    store.failOnRemove = true;
    assert.equal(await removeStoredIssueImages([key], store), false);
    store.failOnRemove = false;
    assert.equal(await removeStoredIssueImages([key], store), true);
    assert.equal(store.objects.has(key), false);
  });

  it("allows the reporter or the assigned department and hides everyone else", () => {
    const reporter = {
      userId: "reporter",
      reporterId: "reporter",
      departmentId: null,
      canWorkDepartment: false,
      assignmentDepartmentId: "roads",
      unassignedClaimable: false,
    };
    assert.equal(canReadIssueImage(reporter), true);
    assert.equal(
      canReadIssueImage({
        ...reporter,
        userId: "staff",
        departmentId: "roads",
        canWorkDepartment: true,
      }),
      true,
    );
    assert.equal(
      canReadIssueImage({
        ...reporter,
        userId: "other-staff",
        departmentId: "lighting",
        canWorkDepartment: true,
      }),
      false,
    );
    assert.equal(
      canReadIssueImage({
        ...reporter,
        userId: "stranger",
        departmentId: "roads",
        canWorkDepartment: false,
      }),
      false,
    );
    assert.equal(
      canReadIssueImage({
        ...reporter,
        userId: "staff",
        departmentId: "roads",
        canWorkDepartment: true,
        assignmentDepartmentId: null,
        unassignedClaimable: true,
      }),
      true,
    );
  });
});
