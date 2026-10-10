import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import type { IssueDeletionStore, IssueDeletionView, MarkDeletedResult } from "@/lib/issues/delete-issue";

type AuditRow = { action: string; metadata: Prisma.JsonValue };

function storageState(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const storage = metadata.storage;
  return typeof storage === "string" ? storage : null;
}

function storageCleared(audits: AuditRow[]): boolean {
  return audits.some((audit) => {
    const storage = storageState(audit.metadata);
    return (
      (audit.action === "issue.delete.storage" && storage === "removed") ||
      (audit.action === "issue.delete" && storage === "none")
    );
  });
}

function metadata(input: {
  reason: string;
  title?: string;
  storage: string;
  storageKeys: string[];
}): Prisma.InputJsonObject {
  return {
    reason: input.reason,
    ...(input.title ? { title: input.title } : {}),
    imageCount: String(input.storageKeys.length),
    storageKeys: input.storageKeys.join(","),
    storage: input.storage,
  };
}

export function createIssueDeletionStore(): IssueDeletionStore {
  const prisma = getPrismaClient();

  async function load(id: string): Promise<IssueDeletionView | null> {
    const issue = await prisma.issue.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        deletedAt: true,
        images: { select: { id: true } },
      },
    });
    if (!issue) return null;
    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Issue", entityId: id, action: { in: ["issue.delete", "issue.delete.storage"] } },
      select: { action: true, metadata: true },
    });
    return {
      id: issue.id,
      title: issue.title,
      status: issue.status,
      deletedAt: issue.deletedAt,
      imageCount: issue.images.length,
      storageCleared: storageCleared(audits),
    };
  }

  return {
    find: load,

    async markDeleted(input): Promise<MarkDeletedResult> {
      try {
        return await prisma.$transaction(async (tx) => {
          const issue = await tx.issue.findUnique({
            where: { id: input.issueId },
            select: {
              id: true,
              title: true,
              deletedAt: true,
              images: { select: { storageKey: true } },
            },
          });
          if (!issue) return { ok: false, reason: "missing" };
          if (issue.title !== input.confirmation) return { ok: false, reason: "confirm" };
          const storageKeys = issue.images.map((image) => image.storageKey);
          const audits = await tx.auditLog.findMany({
            where: {
              entityType: "Issue",
              entityId: issue.id,
              action: { in: ["issue.delete", "issue.delete.storage"] },
            },
            select: { action: true, metadata: true },
          });
          if (issue.deletedAt) {
            return { ok: true, already: true, storageKeys, storageCleared: storageCleared(audits) };
          }

          const hidden = await tx.issue.updateMany({
            where: { id: issue.id, deletedAt: null },
            data: { deletedAt: input.now, publishedAt: null },
          });
          if (hidden.count === 0) {
            return { ok: true, already: true, storageKeys, storageCleared: storageCleared(audits) };
          }
          await tx.issueImage.updateMany({
            where: { issueId: issue.id, deletedAt: null },
            data: { deletedAt: input.now },
          });
          await tx.auditLog.create({
            data: {
              actorId: input.actorId,
              action: "issue.delete",
              entityType: "Issue",
              entityId: issue.id,
              metadata: metadata({
                reason: input.reason,
                title: issue.title,
                storage: storageKeys.length === 0 ? "none" : "pending",
                storageKeys,
              }),
              ipAddress: input.ipAddress,
              createdAt: input.now,
            },
          });
          return {
            ok: true,
            already: false,
            storageKeys,
            storageCleared: storageKeys.length === 0,
          };
        });
      } catch {
        console.error("Issue deletion could not be recorded.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async recordStorage(input) {
      await prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "issue.delete.storage",
          entityType: "Issue",
          entityId: input.issueId,
          metadata: metadata({
            reason: input.reason,
            storage: input.removed ? "removed" : "failed",
            storageKeys: input.storageKeys,
          }),
          ipAddress: input.ipAddress,
          createdAt: input.now,
        },
      });
    },
  };
}
