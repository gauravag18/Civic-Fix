import type { PersistReportInput, PersistReportResult } from "@/lib/issues/persist-report";
import type {
  IssueCategoryOption,
  IssueDetail,
  IssueSummary,
  PublicIssueCard,
  PublicListFilters,
} from "@/lib/issues/types";

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
  listPublic(
    filters: PublicListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ ok: true; total: number; items: PublicIssueCard[] } | { ok: false; reason: "unavailable" }>;
  getPublic(
    issueId: string,
  ): Promise<{ ok: true; issue: PublicIssueCard | null } | { ok: false; reason: "unavailable" }>;
  getOwnedPublication(
    reporterId: string,
    issueId: string,
  ): Promise<{ ok: true; publishedAt: Date | null } | { ok: false; reason: "missing" | "unavailable" }>;
  setOwnedPublication(input: {
    reporterId: string;
    issueId: string;
    publish: boolean;
    now: Date;
    ipAddress: string | null;
  }): Promise<{ ok: true; publishedAt: Date | null } | { ok: false; reason: "missing" | "unavailable" }>;
};
