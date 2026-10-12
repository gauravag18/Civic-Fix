import "server-only";

import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { createPrismaIssueStore } from "@/lib/issues/prisma-store";
import { getCitizenIssue, listCitizenIssues } from "@/lib/issues/service";
import type { IssueCategoryOption } from "@/lib/issues/types";

export async function loadReportPage(): Promise<
  | { state: "signed-out" }
  | { state: "forbidden" }
  | { state: "unavailable" }
  | { state: "ready"; categories: IssueCategoryOption[] }
> {
  try {
    const authorization = await getAuthorization();
    if (!authorization) return { state: "signed-out" };
    if (!hasCapability(authorization.capabilities, Capability.accountSelf)) {
      return { state: "forbidden" };
    }
    const categories = await createPrismaIssueStore().listActiveCategories();
    return { state: "ready", categories };
  } catch {
    return { state: "unavailable" };
  }
}

export async function loadMyIssues(page: unknown) {
  try {
    const authorization = await getAuthorization();
    return await listCitizenIssues(authorization, page, createPrismaIssueStore());
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
}

export async function loadMyIssue(issueId: string) {
  try {
    const authorization = await getAuthorization();
    const result = await getCitizenIssue(authorization, issueId, createPrismaIssueStore());
    return { authorization, result };
  } catch {
    return {
      authorization: null,
      result: { ok: false as const, reason: "unavailable" as const },
    };
  }
}
