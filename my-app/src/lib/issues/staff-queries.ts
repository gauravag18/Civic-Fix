import "server-only";

import { getAuthorization } from "@/lib/auth/authorization";
import { createPrismaDepartmentStore } from "@/lib/issues/prisma-department";
import {
  getDepartmentIssue,
  listDepartmentQueue,
  type DepartmentAccess,
  type QueueKind,
} from "@/lib/issues/staff-service";

function accessFrom(
  authorization: Awaited<ReturnType<typeof getAuthorization>>,
): DepartmentAccess {
  if (!authorization) return null;
  return {
    userId: authorization.userId,
    departmentId: authorization.departmentId,
    capabilities: authorization.capabilities,
    mustChangePassword: authorization.mustChangePassword,
  };
}

export async function loadDepartmentQueue(kind: QueueKind, page: unknown) {
  try {
    const authorization = await getAuthorization();
    return await listDepartmentQueue(
      accessFrom(authorization),
      kind,
      page,
      createPrismaDepartmentStore(),
    );
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
}

export async function loadDepartmentIssue(issueId: string) {
  try {
    const authorization = await getAuthorization();
    return await getDepartmentIssue(
      accessFrom(authorization),
      issueId,
      createPrismaDepartmentStore(),
    );
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
}
