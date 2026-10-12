import { normalizeSearch } from "@/lib/admin/rules";
import { requireAdmin } from "@/lib/admin/service";
import { ADMIN_PAGE_SIZE, type AdminAccess } from "@/lib/admin/types";
import type { IssueStatus, Severity } from "@/generated/prisma/enums";
import { pageNumber } from "@/lib/issues/service";
import { isUuid } from "@/lib/issues/validate";

export type AdminIssueSummary = {
  id: string;
  title: string;
  categoryName: string;
  severity: Severity;
  status: IssueStatus;
  createdAt: Date;
  reporterName: string;
  departmentName: string | null;
  assigneeName: string | null;
  deletedAt: Date | null;
};

export type AdminIssueInspection = AdminIssueSummary & {
  description: string;
  location: {
    description: string;
    locality: string | null;
    city: string;
    postalCode: string | null;
  };
  comments: { id: string; body: string; createdAt: Date; authorName: string }[];
  history: {
    id: string;
    fromStatus: IssueStatus | null;
    toStatus: IssueStatus;
    reason: string | null;
    createdAt: Date;
  }[];
  images: { id: string }[];
};

export type AdminIssueReadStore = {
  search(query: string, page: number, pageSize: number): Promise<{ total: number; items: AdminIssueSummary[] }>;
  inspect(id: string): Promise<AdminIssueInspection | null>;
};

export type AdminIssueListResult =
  | { ok: true; page: number; pageSize: number; total: number; query: string; items: AdminIssueSummary[] }
  | { ok: false; reason: "signed-out" | "forbidden" | "unavailable" };

export async function browseAdminIssues(
  access: AdminAccess,
  query: string,
  requestedPage: unknown,
  store: AdminIssueReadStore,
): Promise<AdminIssueListResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return admin;
  try {
    const clean = normalizeSearch(query);
    const pageSize = ADMIN_PAGE_SIZE;
    const requested = pageNumber(requestedPage);
    const first = await store.search(clean, requested, pageSize);
    const lastPage = Math.max(1, Math.ceil(first.total / pageSize));
    if (requested > lastPage) {
      const last = await store.search(clean, lastPage, pageSize);
      return { ok: true, page: lastPage, pageSize, total: last.total, query: clean, items: last.items };
    }
    return { ok: true, page: requested, pageSize, total: first.total, query: clean, items: first.items };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function inspectAdminIssue(
  access: AdminAccess,
  issueId: string,
  store: AdminIssueReadStore,
): Promise<
  | { ok: true; issue: AdminIssueInspection }
  | { ok: false; reason: "signed-out" | "forbidden" | "missing" | "unavailable" }
> {
  const admin = requireAdmin(access);
  if (!admin.ok) return admin;
  if (!isUuid(issueId)) return { ok: false, reason: "missing" };
  try {
    const issue = await store.inspect(issueId);
    if (!issue) return { ok: false, reason: "missing" };
    return { ok: true, issue };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
