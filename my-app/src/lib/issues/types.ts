import type { IssueStatus, Severity } from "@/generated/prisma/enums";

export type SeverityValue = Severity;
export type IssueStatusValue = IssueStatus;

export type IssueSummary = {
  id: string;
  title: string;
  categoryName: string;
  severity: SeverityValue;
  status: IssueStatusValue;
  city: string;
  createdAt: Date;
};

export type StatusHistoryEntry = {
  id: string;
  fromStatus: IssueStatusValue | null;
  toStatus: IssueStatusValue;
  changedById: string;
  reason: string | null;
  createdAt: Date;
};

export type IssueDetail = {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  severity: SeverityValue;
  status: IssueStatusValue;
  createdAt: Date;
  location: {
    description: string;
    locality: string | null;
    city: string;
    postalCode: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  history: StatusHistoryEntry[];
};

export type IssueCategoryOption = {
  id: string;
  name: string;
};

export const ISSUE_PAGE_SIZE = 10;
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
