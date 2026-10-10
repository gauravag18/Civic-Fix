import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DELETE_CONFIRM, DELETE_PHOTOS, DELETE_REASON, ADMIN_FORBIDDEN, ADMIN_MISSING, ADMIN_SIGN_IN } from "@/lib/admin/messages";
import type { AdminAccess } from "@/lib/admin/types";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { deleteIssueAsAdmin, type IssueDeletionStore, type MarkDeletedResult } from "@/lib/issues/delete-issue";
import type { ObjectStore } from "@/lib/issues/image-storage";
import type { IssueStatus } from "@/generated/prisma/enums";

const now = new Date("2026-10-10T12:00:00.000Z");
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const issueId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherIssueId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const jpeg = "11111111-1111-4111-8111-111111111111.jpg";
const png = "22222222-2222-4222-8222-222222222222.png";

type ImageRow = { storageKey: string; deletedAt: Date | null };
type IssueRow = {
  id: string;
  title: string;
  status: IssueStatus;
  reporterId: string;
  publishedAt: Date | null;
  deletedAt: Date | null;
  images: ImageRow[];
  storageCleared: boolean;
};
type AuditRow = {
  actorId: string;
  action: string;
  entityId: string;
  metadata: { reason: string; storage: string; storageKeys: string; title?: string };
};

class MemoryDeletion implements IssueDeletionStore {
  issues: IssueRow[] = [];
  audits: AuditRow[] = [];
  users = [{ id: adminId, email: "ada@example.com" }, { id: otherId, email: "sam@example.com" }];

  async find(id: string) {
    const issue = this.issues.find((row) => row.id === id);
    if (!issue) return null;
    return {
      id: issue.id,
      title: issue.title,
      status: issue.status,
      deletedAt: issue.deletedAt,
      imageCount: issue.images.length,
      storageCleared: issue.storageCleared,
    };
  }

  async markDeleted(input: {
    issueId: string;
    confirmation: string;
    reason: string;
    actorId: string;
    now: Date;
    ipAddress: string | null;
  }): Promise<MarkDeletedResult> {
    const issue = this.issues.find((row) => row.id === input.issueId);
    if (!issue) return { ok: false, reason: "missing" };
    if (issue.title !== input.confirmation) return { ok: false, reason: "confirm" };
    const storageKeys = issue.images.map((image) => image.storageKey);
    if (issue.deletedAt) {
      return { ok: true, already: true, storageKeys, storageCleared: issue.storageCleared };
    }
    issue.deletedAt = input.now;
    issue.publishedAt = null;
    for (const image of issue.images) image.deletedAt = input.now;
    const storage = storageKeys.length === 0 ? "none" : "pending";
    if (storage === "none") issue.storageCleared = true;
    this.audits.push({
      actorId: input.actorId,
      action: "issue.delete",
      entityId: issue.id,
      metadata: { reason: input.reason, title: issue.title, storage, storageKeys: storageKeys.join(",") },
    });
    return { ok: true, already: false, storageKeys, storageCleared: issue.storageCleared };
  }

  async recordStorage(input: {
    issueId: string;
    actorId: string;
    reason: string;
    storageKeys: string[];
    removed: boolean;
    now: Date;
    ipAddress: string | null;
  }) {
    const issue = this.issues.find((row) => row.id === input.issueId);
    if (issue && input.removed) issue.storageCleared = true;
    this.audits.push({
      actorId: input.actorId,
      action: "issue.delete.storage",
      entityId: input.issueId,
      metadata: {
        reason: input.reason,
        storage: input.removed ? "removed" : "failed",
        storageKeys: input.storageKeys.join(","),
      },
    });
  }
}

class MemoryObjects implements ObjectStore {
  removed: string[][] = [];
  fail = false;
  async put() {
    throw new Error("unused");
  }
  async remove(keys: string[]) {
    if (this.fail) throw new Error("remove failed");
    this.removed.push([...keys]);
  }
  async read() {
    return null;
  }
}

function admin(): AdminAccess {
  return { userId: adminId, capabilities: capabilitiesFor(["ADMINISTRATOR"], null) };
}

function failureMessage(result: Awaited<ReturnType<typeof deleteIssueAsAdmin>>): string {
  return result.ok ? "" : result.message;
}

function issue(id: string, title: string, keys: string[]): IssueRow {
  return {
    id,
    title,
    status: "REPORTED",
    reporterId: otherId,
    publishedAt: now,
    deletedAt: null,
    storageCleared: false,
    images: keys.map((storageKey) => ({ storageKey, deletedAt: null })),
  };
}

describe("administrative issue deletion", () => {
  it("lets an administrator hide a report and remove its photographs", async () => {
    const store = new MemoryDeletion();
    store.issues.push(issue(issueId, "Broken footpath", [jpeg, png]), issue(otherIssueId, "Other report", [jpeg]));
    const users = structuredClone(store.users);
    const objects = new MemoryObjects();
    const result = await deleteIssueAsAdmin(
      admin(),
      { issueId, confirmation: "Broken footpath", reason: "Storage check, remove this report." },
      store,
      objects,
      now,
      null,
    );
    assert.deepEqual(result, { ok: true, outcome: "deleted" });
    assert.equal(store.issues[0]?.deletedAt?.toISOString(), now.toISOString());
    assert.equal(store.issues[0]?.publishedAt, null);
    assert.equal(store.issues[0]?.images[0]?.deletedAt?.toISOString(), now.toISOString());
    assert.equal(store.issues[0]?.images[1]?.deletedAt?.toISOString(), now.toISOString());
    assert.deepEqual(objects.removed, [[jpeg, png]]);
    assert.equal(store.issues[1]?.deletedAt, null);
    assert.equal(store.issues[1]?.publishedAt?.toISOString(), now.toISOString());
    assert.deepEqual(store.users, users);
    const deletion = store.audits.find((row) => row.action === "issue.delete");
    assert.equal(deletion?.actorId, adminId);
    assert.equal(deletion?.entityId, issueId);
    assert.equal(deletion?.metadata.reason, "Storage check, remove this report.");
    assert.equal(deletion?.metadata.title, "Broken footpath");
    assert.equal(deletion?.metadata.storageKeys, `${jpeg},${png}`);
    assert.equal(store.audits.some((row) => row.action === "issue.delete.storage" && row.metadata.storage === "removed"), true);
  });

  it("removes nothing from storage when the report has no photographs", async () => {
    const store = new MemoryDeletion();
    store.issues.push(issue(issueId, "Broken footpath", []));
    const objects = new MemoryObjects();
    const result = await deleteIssueAsAdmin(
      admin(),
      { issueId, confirmation: "Broken footpath", reason: "Duplicate report." },
      store,
      objects,
      now,
      null,
    );
    assert.deepEqual(result, { ok: true, outcome: "deleted" });
    assert.deepEqual(objects.removed, []);
    assert.equal(store.issues[0]?.storageCleared, true);
    assert.equal(store.audits[0]?.metadata.storage, "none");
  });

  it("keeps the image keys when storage deletion fails and retries only those keys", async () => {
    const store = new MemoryDeletion();
    store.issues.push(issue(issueId, "Broken footpath", [jpeg]));
    const objects = new MemoryObjects();
    objects.fail = true;
    const failed = await deleteIssueAsAdmin(
      admin(),
      { issueId, confirmation: "Broken footpath", reason: "Storage check." },
      store,
      objects,
      now,
      null,
    );
    assert.deepEqual(failed, { ok: false, code: "photos", message: DELETE_PHOTOS });
    assert.ok(store.issues[0]?.deletedAt);
    assert.equal(store.issues[0]?.images[0]?.storageKey, jpeg);
    assert.equal(store.issues[0]?.storageCleared, false);
    assert.equal(store.audits.some((row) => row.metadata.storage === "failed"), true);

    objects.fail = false;
    const retried = await deleteIssueAsAdmin(
      admin(),
      { issueId, confirmation: "Broken footpath", reason: "Retry photograph removal." },
      store,
      objects,
      new Date(now.getTime() + 1000),
      null,
    );
    assert.deepEqual(retried, { ok: true, outcome: "already" });
    assert.deepEqual(objects.removed, [[jpeg]]);
    assert.equal(store.issues[0]?.storageCleared, true);
    assert.equal(store.audits.filter((row) => row.action === "issue.delete").length, 1);
  });

  it("refuses signed-out users, citizens, staff, a missing report, and a bad confirmation or reason", async () => {
    const store = new MemoryDeletion();
    store.issues.push(issue(issueId, "Broken footpath", [jpeg]));
    const objects = new MemoryObjects();
    const input = { issueId, confirmation: "Broken footpath", reason: "Storage check." };
    assert.equal(failureMessage(await deleteIssueAsAdmin(null, input, store, objects, now, null)), ADMIN_SIGN_IN);
    assert.equal(
      failureMessage(
        await deleteIssueAsAdmin(
          { userId: otherId, capabilities: capabilitiesFor(["CITIZEN"], null) },
          input,
          store,
          objects,
          now,
          null,
        ),
      ),
      ADMIN_FORBIDDEN,
    );
    assert.equal(
      failureMessage(
        await deleteIssueAsAdmin(
          { userId: otherId, capabilities: capabilitiesFor(["DEPARTMENT_STAFF"], "department") },
          input,
          store,
          objects,
          now,
          null,
        ),
      ),
      ADMIN_FORBIDDEN,
    );
    assert.equal(
      failureMessage(await deleteIssueAsAdmin(admin(), { ...input, issueId: "not-an-id" }, store, objects, now, null)),
      ADMIN_MISSING,
    );
    assert.equal(
      failureMessage(
        await deleteIssueAsAdmin(admin(), { ...input, confirmation: "Wrong title" }, store, objects, now, null),
      ),
      DELETE_CONFIRM,
    );
    assert.equal(
      failureMessage(await deleteIssueAsAdmin(admin(), { ...input, reason: "   " }, store, objects, now, null)),
      DELETE_REASON,
    );
    assert.equal(store.issues[0]?.deletedAt, null);
    assert.deepEqual(objects.removed, []);
    assert.equal(store.audits.length, 0);
  });

  it("does not call storage again after a completed deletion", async () => {
    const store = new MemoryDeletion();
    const row = issue(issueId, "Broken footpath", [jpeg]);
    row.deletedAt = now;
    row.storageCleared = true;
    store.issues.push(row);
    const objects = new MemoryObjects();
    const result = await deleteIssueAsAdmin(
      admin(),
      { issueId, confirmation: "Broken footpath", reason: "Already done." },
      store,
      objects,
      now,
      null,
    );
    assert.deepEqual(result, { ok: true, outcome: "already" });
    assert.deepEqual(objects.removed, []);
  });
});
