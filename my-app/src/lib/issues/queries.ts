import "server-only";

import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { getPublicIssue, listPublicIssues, type PublicQueryInput } from "@/lib/issues/discovery";
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

export async function loadOwnedPublication(issueId: string) {
  try {
    const authorization = await getAuthorization();
    if (!authorization) return { state: "missing" as const };
    const result = await createPrismaIssueStore().getOwnedPublication(authorization.userId, issueId);
    if (!result.ok) return { state: result.reason };
    return { state: "ready" as const, publishedAt: result.publishedAt };
  } catch {
    return { state: "unavailable" as const };
  }
}

export async function loadExplore(input: PublicQueryInput) {
  try {
    const store = createPrismaIssueStore();
    const categories = await store.listActiveCategories();
    const result = await listPublicIssues(input, store);
    return { categories, result };
  } catch {
    return {
      categories: [] as { id: string; name: string }[],
      result: { ok: false as const, reason: "unavailable" as const },
    };
  }
}

export async function loadPublicIssue(issueId: string) {
  try {
    return await getPublicIssue(issueId, createPrismaIssueStore());
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
}
