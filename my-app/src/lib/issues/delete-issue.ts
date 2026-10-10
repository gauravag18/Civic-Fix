import { DELETE_CONFIRM, DELETE_PHOTOS, DELETE_REASON, ADMIN_FORBIDDEN, ADMIN_MISSING, ADMIN_SAVE_FAILED, ADMIN_SIGN_IN } from "@/lib/admin/messages";
import { requireAdmin } from "@/lib/admin/service";
import type { AdminAccess } from "@/lib/admin/types";
import type { IssueStatus } from "@/generated/prisma/enums";
import { removeStoredIssueImages, type ObjectStore } from "@/lib/issues/image-storage";
import { isUuid } from "@/lib/issues/validate";

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const REASON_MAX = 500;

export type IssueDeletionView = {
  id: string;
  title: string;
  status: IssueStatus;
  deletedAt: Date | null;
  imageCount: number;
  storageCleared: boolean;
};

export type MarkDeletedResult =
  | { ok: true; already: boolean; storageKeys: string[]; storageCleared: boolean }
  | { ok: false; reason: "missing" | "confirm" | "unavailable" };

export type IssueDeletionStore = {
  find(id: string): Promise<IssueDeletionView | null>;
  markDeleted(input: {
    issueId: string;
    confirmation: string;
    reason: string;
    actorId: string;
    now: Date;
    ipAddress: string | null;
  }): Promise<MarkDeletedResult>;
  recordStorage(input: {
    issueId: string;
    actorId: string;
    reason: string;
    storageKeys: string[];
    removed: boolean;
    now: Date;
    ipAddress: string | null;
  }): Promise<void>;
};

export type DeleteIssueResult =
  | { ok: true; outcome: "deleted" | "already" }
  | { ok: false; code: "form" | "photos"; message: string };

export function cleanDeletionReason(value: string): string | null {
  const text = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (CONTROL.test(value) || text.length < 1 || text.length > REASON_MAX) return null;
  return text;
}

export async function deleteIssueAsAdmin(
  access: AdminAccess,
  input: { issueId: string; confirmation: string; reason: string },
  store: IssueDeletionStore,
  images: ObjectStore | null,
  now: Date,
  ipAddress: string | null,
): Promise<DeleteIssueResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) {
    return { ok: false, code: "form", message: admin.reason === "signed-out" ? ADMIN_SIGN_IN : ADMIN_FORBIDDEN };
  }
  if (!isUuid(input.issueId)) return { ok: false, code: "form", message: ADMIN_MISSING };
  const reason = cleanDeletionReason(input.reason);
  if (!reason) return { ok: false, code: "form", message: DELETE_REASON };
  const confirmation = input.confirmation.trim();
  if (!confirmation) return { ok: false, code: "form", message: DELETE_CONFIRM };

  const marked = await store.markDeleted({
    issueId: input.issueId,
    confirmation,
    reason,
    actorId: admin.userId,
    now,
    ipAddress,
  });
  if (!marked.ok) {
    if (marked.reason === "confirm") return { ok: false, code: "form", message: DELETE_CONFIRM };
    if (marked.reason === "missing") return { ok: false, code: "form", message: ADMIN_MISSING };
    return { ok: false, code: "form", message: ADMIN_SAVE_FAILED };
  }
  if (marked.storageCleared) {
    return { ok: true, outcome: marked.already ? "already" : "deleted" };
  }

  const removed = await removeStoredIssueImages(marked.storageKeys, images);
  try {
    await store.recordStorage({
      issueId: input.issueId,
      actorId: admin.userId,
      reason,
      storageKeys: marked.storageKeys,
      removed,
      now,
      ipAddress,
    });
  } catch {
    return { ok: false, code: "photos", message: DELETE_PHOTOS };
  }
  if (!removed) return { ok: false, code: "photos", message: DELETE_PHOTOS };
  return { ok: true, outcome: marked.already ? "already" : "deleted" };
}
