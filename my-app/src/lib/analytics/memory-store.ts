import { IssueStatus } from "@/generated/prisma/enums";
import {
  departmentChartName,
  inRange,
  isOpenStatus,
  isResolvedStatus,
  missingResolutionTimestamp,
  monthKey,
  STATUS_ORDER,
  usableResolutionSeconds,
} from "@/lib/analytics/metrics";
import type { AnalyticsScope, AnalyticsSnapshot, AnalyticsStore, MonthCount } from "@/lib/analytics/types";

export type MemoryAnalyticsIssue = {
  id: string;
  categoryName: string;
  status: IssueStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  deletedAt: Date | null;
  departmentId: string | null;
};

export type MemoryAnalyticsDepartment = {
  id: string;
  name: string;
  isActive: boolean;
};

export type MemoryAnalyticsStore = AnalyticsStore & {
  reads: number;
  lastDepartmentId: string | null | undefined;
};

export function createMemoryAnalyticsStore(
  issues: readonly MemoryAnalyticsIssue[],
  departments: readonly MemoryAnalyticsDepartment[] = [],
): MemoryAnalyticsStore {
  const store: MemoryAnalyticsStore = {
    reads: 0,
    lastDepartmentId: undefined,
    async summarize(scope) {
      store.reads += 1;
      store.lastDepartmentId = scope.departmentId;
      return summarizeMemory(issues, departments, scope);
    },
  };
  return store;
}

function holds(issue: MemoryAnalyticsIssue, departmentId: string | null): boolean {
  if (!departmentId) return true;
  return issue.departmentId === departmentId;
}

function summarizeMemory(
  issues: readonly MemoryAnalyticsIssue[],
  departments: readonly MemoryAnalyticsDepartment[],
  scope: AnalyticsScope,
): AnalyticsSnapshot {
  const filed = issues.filter(
    (issue) =>
      issue.deletedAt === null && holds(issue, scope.departmentId) && inRange(issue.createdAt, scope.range),
  );
  const samples: number[] = [];
  let missing = 0;
  for (const issue of filed) {
    const seconds = usableResolutionSeconds(issue.status, issue.createdAt, issue.resolvedAt);
    if (seconds !== null) samples.push(seconds);
    if (missingResolutionTimestamp(issue.status, issue.createdAt, issue.resolvedAt)) missing += 1;
  }
  const resolvedSeries = issues.filter(
    (issue) =>
      issue.deletedAt === null &&
      holds(issue, scope.departmentId) &&
      isResolvedStatus(issue.status) &&
      issue.resolvedAt !== null &&
      issue.resolvedAt.getTime() >= issue.createdAt.getTime() &&
      inRange(issue.resolvedAt, scope.range),
  );

  return {
    total: filed.length,
    open: filed.filter((issue) => isOpenStatus(issue.status)).length,
    resolved: filed.filter((issue) => isResolvedStatus(issue.status)).length,
    rejected: filed.filter((issue) => issue.status === IssueStatus.REJECTED).length,
    resolutionSample: samples.length,
    resolvedMissingTimestamp: missing,
    averageResolutionSeconds:
      samples.length === 0 ? null : samples.reduce((sum, value) => sum + value, 0) / samples.length,
    byStatus: STATUS_ORDER.flatMap((status) => {
      const count = filed.filter((issue) => issue.status === status).length;
      return count > 0 ? [{ status, count }] : [];
    }),
    byCategory: categoryCounts(filed),
    reportedByMonth: monthCounts(filed.map((issue) => issue.createdAt)),
    resolvedByMonth: monthCounts(
      resolvedSeries.flatMap((issue) => (issue.resolvedAt ? [issue.resolvedAt] : [])),
    ),
    departments: scope.includeDepartments ? departmentCounts(issues, departments, scope) : null,
  };
}

function categoryCounts(issues: readonly MemoryAnalyticsIssue[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const issue of issues) counts.set(issue.categoryName, (counts.get(issue.categoryName) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function monthCounts(values: readonly Date[]): MonthCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const month = monthKey(value);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function departmentCounts(
  issues: readonly MemoryAnalyticsIssue[],
  departments: readonly MemoryAnalyticsDepartment[],
  scope: AnalyticsScope,
): { name: string; assigned: number; resolved: number }[] {
  return departments
    .map((department) => {
      const held = issues.filter(
        (issue) =>
          issue.deletedAt === null &&
          issue.departmentId === department.id &&
          inRange(issue.createdAt, scope.range),
      );
      return {
        name: departmentChartName(department.name, department.isActive),
        assigned: held.length,
        resolved: held.filter((issue) => isResolvedStatus(issue.status)).length,
        visible: department.isActive || held.length > 0,
      };
    })
    .filter((row) => row.visible)
    .map(({ name, assigned, resolved }) => ({ name, assigned, resolved }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
