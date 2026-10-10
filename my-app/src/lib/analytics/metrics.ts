import { IssueStatus } from "@/generated/prisma/enums";

/** Statuses that end the open queue. Reopened stays open. */
export const TERMINAL_STATUSES: readonly IssueStatus[] = [
  IssueStatus.RESOLVED,
  IssueStatus.CLOSED,
  IssueStatus.REJECTED,
];

/** Current statuses counted as resolved. Rejected is terminal and unresolved. */
export const RESOLVED_STATUSES: readonly IssueStatus[] = [IssueStatus.RESOLVED, IssueStatus.CLOSED];

export const STATUS_ORDER: readonly IssueStatus[] = [
  IssueStatus.REPORTED,
  IssueStatus.UNDER_REVIEW,
  IssueStatus.VERIFIED,
  IssueStatus.ASSIGNED,
  IssueStatus.IN_PROGRESS,
  IssueStatus.RESOLVED,
  IssueStatus.CLOSED,
  IssueStatus.REJECTED,
  IssueStatus.REOPENED,
];

export const MAX_SPAN_DAYS = 3660;
export const MAX_MONTHS = 120;
const EARLIEST_UTC = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateRange =
  | { kind: "all" }
  | { kind: "span"; from: Date; to: Date };

export type AnalyticsQuery = {
  from?: unknown;
  to?: unknown;
  /** Ignored. Department scope comes from the signed-in membership. */
  departmentId?: unknown;
};

export const METRIC_NOTES = [
  {
    term: "Total issues",
    text: "Reports filed during the selected period. Deleted reports are excluded. The period uses the report creation time, as UTC calendar days, and includes the end date.",
  },
  {
    term: "Open issues",
    text: "Reports in that filing period whose current status is not Resolved, Closed, or Rejected. Reopened reports count as open.",
  },
  {
    term: "Resolved issues",
    text: "Reports in that filing period whose current status is Resolved or Closed. Rejected reports stay in the total and are not counted as resolved.",
  },
  {
    term: "Resolution rate",
    text: "Resolved issues divided by total issues in the same filing period. When that period contains no reports, the rate is not available.",
  },
  {
    term: "Average resolution time",
    text: "The mean of the first resolution time minus the creation time, for reports in the filing period whose current status is Resolved or Closed, when that resolution time is recorded and is not earlier than creation. Reopened reports are excluded because their current status is Reopened. Resolved or closed reports without a usable resolution time are counted beside the average and left out of it.",
  },
  {
    term: "Reported months",
    text: "Counts of reports by the UTC month of the creation time, inside the filing period.",
  },
  {
    term: "Resolved months",
    text: "Counts of Resolved or Closed reports by the UTC month of the resolution time. This series follows the resolution date, so it can include reports filed outside the selected filing period. Deleted reports stay excluded. On the department page the series is still limited to reports currently assigned to that department.",
  },
  {
    term: "Department figures",
    text: "A report counts for a department only while an assignment to that department is still active. Workload is that current assignment. Resolved counts are those currently assigned reports whose status is Resolved or Closed. When a report moves, it counts for the department that holds it now. CivicFix does not store a separate “resolved by” department, so earlier departments are not credited. Unassigned reports stay in the administrator totals and stay out of the department comparison. Deactivated departments appear only when they still hold a current assignment.",
  },
] as const;

export function isResolvedStatus(status: IssueStatus): boolean {
  return status === IssueStatus.RESOLVED || status === IssueStatus.CLOSED;
}

export function isOpenStatus(status: IssueStatus): boolean {
  return (
    status !== IssueStatus.RESOLVED &&
    status !== IssueStatus.CLOSED &&
    status !== IssueStatus.REJECTED
  );
}

/** Resolved divided by total. A zero total has no rate. */
export function resolutionRate(resolved: number, total: number): number | null {
  if (total <= 0) return null;
  return resolved / total;
}

/**
 * Seconds from creation to the first resolution timestamp.
 * Reopened issues are not resolved. A missing or earlier timestamp is unusable.
 */
export function usableResolutionSeconds(
  status: IssueStatus,
  createdAt: Date,
  resolvedAt: Date | null,
): number | null {
  if (!isResolvedStatus(status) || !resolvedAt || resolvedAt.getTime() < createdAt.getTime()) {
    return null;
  }
  return (resolvedAt.getTime() - createdAt.getTime()) / 1000;
}

export function missingResolutionTimestamp(
  status: IssueStatus,
  createdAt: Date,
  resolvedAt: Date | null,
): boolean {
  return isResolvedStatus(status) && usableResolutionSeconds(status, createdAt, resolvedAt) === null;
}

export function monthKey(value: Date): string {
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${value.getUTCFullYear()}-${month}`;
}

export function inRange(value: Date, range: DateRange): boolean {
  if (range.kind === "all") return true;
  return value.getTime() >= range.from.getTime() && value.getTime() < range.to.getTime();
}

export function capMonths<T extends { month: string }>(
  rows: readonly T[],
): { rows: T[]; truncated: boolean } {
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  if (sorted.length <= MAX_MONTHS) return { rows: sorted, truncated: false };
  return { rows: sorted.slice(sorted.length - MAX_MONTHS), truncated: true };
}

export function formatRange(range: DateRange): string {
  if (range.kind === "all") return "All time";
  const end = new Date(range.to.getTime() - DAY_MS);
  return `${range.from.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)} (UTC)`;
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "Not available";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not available";
  const hours = seconds / 3600;
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function departmentChartName(name: string, isActive: boolean): string {
  return isActive ? name : `${name} (inactive)`;
}

export function parseAnalyticsRange(
  query: AnalyticsQuery,
  now: Date,
): { ok: true; range: DateRange } | { ok: false; reason: "invalid" } {
  const from = cleanDay(query.from);
  const to = cleanDay(query.to);
  if (from === "bad" || to === "bad") return { ok: false, reason: "invalid" };
  if (from === null && to === null) return { ok: true, range: { kind: "all" } };
  if (from === null || to === null) return { ok: false, reason: "invalid" };
  const start = utcDay(from);
  const inclusiveEnd = utcDay(to);
  if (!start || !inclusiveEnd) return { ok: false, reason: "invalid" };
  if (start.getTime() < EARLIEST_UTC) return { ok: false, reason: "invalid" };
  if (inclusiveEnd.getTime() < start.getTime()) return { ok: false, reason: "invalid" };
  const exclusiveEnd = inclusiveEnd.getTime() + DAY_MS;
  const spanDays = (exclusiveEnd - start.getTime()) / DAY_MS;
  if (spanDays > MAX_SPAN_DAYS) return { ok: false, reason: "invalid" };
  const latest = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2);
  if (exclusiveEnd > latest) return { ok: false, reason: "invalid" };
  return { ok: true, range: { kind: "span", from: start, to: new Date(exclusiveEnd) } };
}

function cleanDay(value: unknown): string | null | "bad" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "bad";
  const text = value.trim();
  if (!text) return null;
  return text;
}

function utcDay(value: string): Date | null {
  const match = DAY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}
