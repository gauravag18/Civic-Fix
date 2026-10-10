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

export type IssueCommentView = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
};

export type DepartmentAssignment = {
  assigneeId: string | null;
  assigneeName: string | null;
  note: string | null;
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
  comments: IssueCommentView[];
  images: { id: string }[];
};

export type DepartmentIssue = IssueDetail & {
  assignment: DepartmentAssignment | null;
};

export type IssueCategoryOption = {
  id: string;
  name: string;
};

export const ISSUE_PAGE_SIZE = 10;
export const PUBLIC_PAGE_SIZE = 10;

export type PublicIssueCard = {
  id: string;
  title: string;
  categoryName: string;
  locality: string | null;
  city: string;
  status: IssueStatusValue;
  createdAt: Date;
};

export type PublicSort = "newest" | "updated";

export type PublicListFilters = {
  q: string;
  categoryId: string | null;
  status: IssueStatusValue | null;
  sort: PublicSort;
};
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
