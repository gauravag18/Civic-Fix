import "server-only";

import { requireAdmin } from "@/lib/admin/service";
import type { AdminAccess } from "@/lib/admin/types";
import { getAuthorization } from "@/lib/auth/authorization";
import { createIssueDeletionStore } from "@/lib/issues/prisma-delete";
import type { IssueDeletionView } from "@/lib/issues/delete-issue";
import { isUuid } from "@/lib/issues/validate";

async function access(): Promise<AdminAccess> {
  const authorization = await getAuthorization();
  if (!authorization) return null;
  return { userId: authorization.userId, capabilities: authorization.capabilities };
}

export async function loadAdminIssueGate(): Promise<
  { ok: true } | { ok: false; reason: "signed-out" | "forbidden" }
> {
  const admin = requireAdmin(await access());
  if (!admin.ok) return admin;
  return { ok: true };
}

export async function loadAdminIssueForDeletion(id: string): Promise<
  | { ok: true; issue: IssueDeletionView }
  | { ok: false; reason: "signed-out" | "forbidden" | "missing" | "unavailable" }
> {
  const admin = requireAdmin(await access());
  if (!admin.ok) return admin;
  if (!isUuid(id)) return { ok: false, reason: "missing" };
  try {
    const issue = await createIssueDeletionStore().find(id);
    if (!issue) return { ok: false, reason: "missing" };
    return { ok: true, issue };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
