import type { IssueStatus } from "@/generated/prisma/enums";
import type { DateRange } from "@/lib/analytics/metrics";

export type MonthCount = { month: string; count: number };

export type DepartmentCount = {
  name: string;
  assigned: number;
  resolved: number;
};

export type AnalyticsSnapshot = {
  total: number;
  open: number;
  resolved: number;
  rejected: number;
  resolutionSample: number;
  resolvedMissingTimestamp: number;
  averageResolutionSeconds: number | null;
  byStatus: { status: IssueStatus; count: number }[];
  byCategory: { name: string; count: number }[];
  reportedByMonth: MonthCount[];
  resolvedByMonth: MonthCount[];
  departments: DepartmentCount[] | null;
};

export type AnalyticsScope = {
  range: DateRange;
  departmentId: string | null;
  includeDepartments: boolean;
};

export type AnalyticsStore = {
  summarize(scope: AnalyticsScope): Promise<AnalyticsSnapshot>;
};

export type AnalyticsReport = {
  scope: "admin" | "department";
  range: DateRange;
  total: number;
  open: number;
  resolved: number;
  rejected: number;
  resolutionRate: number | null;
  averageResolutionSeconds: number | null;
  resolutionSample: number;
  resolvedMissingTimestamp: number;
  byStatus: { status: IssueStatus; count: number }[];
  byCategory: { name: string; count: number }[];
  reportedByMonth: MonthCount[];
  resolvedByMonth: MonthCount[];
  monthsTruncated: boolean;
  departments: DepartmentCount[] | null;
};
