import { requireAdmin } from "@/lib/admin/service";
import type { AdminAccess } from "@/lib/admin/types";
import {
  capMonths,
  parseAnalyticsRange,
  resolutionRate,
  type AnalyticsQuery,
  type DateRange,
} from "@/lib/analytics/metrics";
import type { AnalyticsReport, AnalyticsSnapshot, AnalyticsStore } from "@/lib/analytics/types";
import { requireStaff, type DepartmentAccess } from "@/lib/issues/staff-service";

export type AdminAnalyticsResult =
  | { ok: true; report: AnalyticsReport }
  | { ok: false; reason: "signed-out" | "forbidden" | "invalid-range" | "unavailable" };

export type DepartmentAnalyticsResult =
  | { ok: true; report: AnalyticsReport }
  | { ok: false; reason: "signed-out" | "forbidden" | "invalid-range" | "unavailable" };

export async function loadAdminAnalytics(
  access: AdminAccess,
  query: AnalyticsQuery,
  store: AnalyticsStore,
  now = new Date(),
): Promise<AdminAnalyticsResult> {
  const gate = requireAdmin(access);
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const parsed = parseAnalyticsRange(query, now);
  if (!parsed.ok) return { ok: false, reason: "invalid-range" };
  const snapshot = await store.summarize({
    range: parsed.range,
    departmentId: null,
    includeDepartments: true,
  });
  return { ok: true, report: toReport("admin", parsed.range, snapshot) };
}

export async function loadDepartmentAnalytics(
  access: DepartmentAccess,
  query: AnalyticsQuery,
  store: AnalyticsStore,
  now = new Date(),
): Promise<DepartmentAnalyticsResult> {
  const gate = requireStaff(access);
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const parsed = parseAnalyticsRange(query, now);
  if (!parsed.ok) return { ok: false, reason: "invalid-range" };
  const snapshot = await store.summarize({
    range: parsed.range,
    departmentId: gate.departmentId,
    includeDepartments: false,
  });
  return { ok: true, report: toReport("department", parsed.range, snapshot) };
}

function toReport(
  scope: AnalyticsReport["scope"],
  range: DateRange,
  snapshot: AnalyticsSnapshot,
): AnalyticsReport {
  const reported = capMonths(snapshot.reportedByMonth);
  const resolved = capMonths(snapshot.resolvedByMonth);
  return {
    scope,
    range,
    total: snapshot.total,
    open: snapshot.open,
    resolved: snapshot.resolved,
    rejected: snapshot.rejected,
    resolutionRate: resolutionRate(snapshot.resolved, snapshot.total),
    averageResolutionSeconds: snapshot.resolutionSample > 0 ? snapshot.averageResolutionSeconds : null,
    resolutionSample: snapshot.resolutionSample,
    resolvedMissingTimestamp: snapshot.resolvedMissingTimestamp,
    byStatus: snapshot.byStatus,
    byCategory: snapshot.byCategory,
    reportedByMonth: reported.rows,
    resolvedByMonth: resolved.rows,
    monthsTruncated: reported.truncated || resolved.truncated,
    departments: snapshot.departments,
  };
}
