import type { PersistReportInput, PersistReportResult } from "@/lib/issues/persist-report";
import type { IssueCategoryOption, IssueDetail, IssueSummary } from "@/lib/issues/types";

export type CreateReportResult =
  | PersistReportResult
  | { ok: false; reason: "unavailable" };

export type IssueStore = {
  createReport(input: PersistReportInput): Promise<CreateReportResult>;
  listActiveCategories(): Promise<IssueCategoryOption[]>;
  listForReporter(
    reporterId: string,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: IssueSummary[] }>;
  getForReporter(reporterId: string, issueId: string): Promise<IssueDetail | null>;
};
