import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { rateKey, type SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import {
  FIELD_CATEGORY,
  ISSUE_CHECK_FIELDS,
  ISSUE_FORBIDDEN,
  ISSUE_SAVE_FAILED,
  ISSUE_SIGN_IN,
} from "@/lib/issues/messages";
import type { PersistImage } from "@/lib/issues/image-rules";
import type { IssueStore } from "@/lib/issues/store";
import { ISSUE_PAGE_SIZE, type IssueDetail, type IssueSummary } from "@/lib/issues/types";
import {
  isUuid,
  validateIssueFields,
  type IssueFieldErrors,
  type RawIssueFields,
} from "@/lib/issues/validate";

export type CitizenAccess = {
  userId: string;
  capabilities: ReadonlySet<string>;
} | null;

export type IssueWriteResult =
  | { ok: true; issueId: string; duplicate: boolean }
  | { ok: false; message: string; fieldErrors: IssueFieldErrors };

export function claimIssueSubmission(
  limiter: SlidingWindowLimiter,
  userId: string,
  nowMs: number,
): boolean {
  return limiter.allow(rateKey(["issue.create", userId]), nowMs);
}

export function pageNumber(value: unknown): number {
  const page = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 1000) return 1;
  return page;
}

export async function createCitizenIssue(
  access: CitizenAccess,
  raw: RawIssueFields,
  store: IssueStore,
  now: Date,
  ipAddress: string | null,
  images: PersistImage[] = [],
): Promise<IssueWriteResult> {
  if (!access) return { ok: false, message: ISSUE_SIGN_IN, fieldErrors: {} };
  if (!hasCapability(access.capabilities, Capability.accountSelf)) {
    return { ok: false, message: ISSUE_FORBIDDEN, fieldErrors: {} };
  }

  const validated = validateIssueFields(raw);
  if (!validated.ok) {
    return { ok: false, message: ISSUE_CHECK_FIELDS, fieldErrors: validated.fieldErrors };
  }

  const written = await store.createReport({
    ...validated.value,
    reporterId: access.userId,
    now,
    ipAddress,
    images,
  });
  if (!written.ok && written.reason === "category") {
    return {
      ok: false,
      message: ISSUE_CHECK_FIELDS,
      fieldErrors: { categoryId: FIELD_CATEGORY },
    };
  }
  if (!written.ok) return { ok: false, message: ISSUE_SAVE_FAILED, fieldErrors: {} };
  return { ok: true, issueId: written.issueId, duplicate: written.duplicate };
}

export async function listCitizenIssues(
  access: CitizenAccess,
  requestedPage: unknown,
  store: IssueStore,
): Promise<
  | { ok: true; page: number; pageSize: number; total: number; items: IssueSummary[] }
  | { ok: false; reason: "signed-out" | "unavailable" }
> {
  if (!access) return { ok: false, reason: "signed-out" };
  try {
    const pageSize = ISSUE_PAGE_SIZE;
    const requested = pageNumber(requestedPage);
    const first = await store.listForReporter(access.userId, requested, pageSize);
    const lastPage = Math.max(1, Math.ceil(first.total / pageSize));
    if (requested > lastPage) {
      const last = await store.listForReporter(access.userId, lastPage, pageSize);
      return { ok: true, page: lastPage, pageSize, total: last.total, items: last.items };
    }
    return { ok: true, page: requested, pageSize, total: first.total, items: first.items };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function getCitizenIssue(
  access: CitizenAccess,
  issueId: string,
  store: IssueStore,
): Promise<
  | { ok: true; issue: IssueDetail }
  | { ok: false; reason: "signed-out" | "missing" | "unavailable" }
> {
  if (!access) return { ok: false, reason: "signed-out" };
  if (!isUuid(issueId)) return { ok: false, reason: "missing" };
  try {
    const issue = await store.getForReporter(access.userId, issueId);
    if (!issue) return { ok: false, reason: "missing" };
    return { ok: true, issue };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
