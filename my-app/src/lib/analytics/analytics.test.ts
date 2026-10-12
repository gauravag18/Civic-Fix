import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IssueStatus } from "@/generated/prisma/enums";
import { Capability, capabilitiesFor } from "@/lib/auth/capabilities";
import {
  capMonths,
  isOpenStatus,
  isResolvedStatus,
  parseAnalyticsRange,
  resolutionRate,
} from "@/lib/analytics/metrics";
import {
  createMemoryAnalyticsStore,
  type MemoryAnalyticsDepartment,
  type MemoryAnalyticsIssue,
} from "@/lib/analytics/memory-store";
import { loadAdminAnalytics, loadDepartmentAnalytics } from "@/lib/analytics/service";
import type { AnalyticsSnapshot, AnalyticsStore } from "@/lib/analytics/types";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const DAY = 86_400_000;

const departments: MemoryAnalyticsDepartment[] = [
  { id: "dept-a", name: "Roads", isActive: true },
  { id: "dept-b", name: "Lighting", isActive: true },
  { id: "dept-old", name: "Old works", isActive: false },
  { id: "dept-idle", name: "Idle", isActive: true },
  { id: "dept-gone", name: "Gone", isActive: false },
];

function issue(input: MemoryAnalyticsIssue): MemoryAnalyticsIssue {
  return input;
}

const issues: MemoryAnalyticsIssue[] = [
  issue({
    id: "a",
    categoryName: "Roads",
    status: IssueStatus.RESOLVED,
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    resolvedAt: new Date("2026-01-20T00:00:00.000Z"),
    deletedAt: null,
    departmentId: "dept-a",
  }),
  issue({
    id: "b",
    categoryName: "Lighting",
    status: IssueStatus.REPORTED,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    resolvedAt: null,
    deletedAt: null,
    departmentId: "dept-a",
  }),
  issue({
    id: "c",
    categoryName: "Roads",
    status: IssueStatus.RESOLVED,
    createdAt: new Date("2026-01-10T00:00:00.000Z"),
    resolvedAt: new Date("2026-02-01T00:00:00.000Z"),
    deletedAt: null,
    departmentId: "dept-b",
  }),
  issue({
    id: "deleted",
    categoryName: "Roads",
    status: IssueStatus.RESOLVED,
    createdAt: new Date("2026-01-05T00:00:00.000Z"),
    resolvedAt: new Date("2026-01-06T00:00:00.000Z"),
    deletedAt: new Date("2026-01-07T00:00:00.000Z"),
    departmentId: "dept-a",
  }),
  issue({
    id: "reopened",
    categoryName: "Roads",
    status: IssueStatus.REOPENED,
    createdAt: new Date("2026-01-12T00:00:00.000Z"),
    resolvedAt: new Date("2026-01-18T00:00:00.000Z"),
    deletedAt: null,
    departmentId: "dept-a",
  }),
  issue({
    id: "closed-without-time",
    categoryName: "Drainage",
    status: IssueStatus.CLOSED,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    resolvedAt: null,
    deletedAt: null,
    departmentId: "dept-a",
  }),
  issue({
    id: "unassigned",
    categoryName: "Parks",
    status: IssueStatus.REPORTED,
    createdAt: new Date("2026-01-08T00:00:00.000Z"),
    resolvedAt: null,
    deletedAt: null,
    departmentId: null,
  }),
  issue({
    id: "rejected",
    categoryName: "Roads",
    status: IssueStatus.REJECTED,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    resolvedAt: null,
    deletedAt: null,
    departmentId: "dept-a",
  }),
  issue({
    id: "old",
    categoryName: "Water",
    status: IssueStatus.IN_PROGRESS,
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
    resolvedAt: null,
    deletedAt: null,
    departmentId: "dept-old",
  }),
];

const adminAccess = {
  userId: "admin",
  capabilities: capabilitiesFor(["ADMINISTRATOR"], null),
};

const staffA = {
  userId: "staff-a",
  departmentId: "dept-a",
  capabilities: capabilitiesFor(["DEPARTMENT_STAFF"], "dept-a"),
  mustChangePassword: false,
};

describe("analytics date ranges", () => {
  it("accepts all time and a bounded inclusive range", () => {
    assert.deepEqual(parseAnalyticsRange({ from: "  ", to: "" }, NOW), {
      ok: true,
      range: { kind: "all" },
    });
    const parsed = parseAnalyticsRange({ from: "2026-01-01", to: "2026-01-31" }, NOW);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.range.kind, "span");
    if (parsed.range.kind !== "span") return;
    assert.equal(parsed.range.from.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(parsed.range.to.toISOString(), "2026-02-01T00:00:00.000Z");
  });

  it("rejects incomplete, impossible, reversed, early, future, and oversized ranges", () => {
    assert.equal(parseAnalyticsRange({ from: "2026-01-01" }, NOW).ok, false);
    assert.equal(parseAnalyticsRange({ to: "2026-01-31" }, NOW).ok, false);
    assert.equal(parseAnalyticsRange({ from: "2026-02-31", to: "2026-03-01" }, NOW).ok, false);
    assert.equal(parseAnalyticsRange({ from: "2026-02-02", to: "2026-02-01" }, NOW).ok, false);
    assert.equal(parseAnalyticsRange({ from: "2019-12-31", to: "2019-12-31" }, NOW).ok, false);
    assert.equal(parseAnalyticsRange({ from: "2026-10-12", to: "2026-10-12" }, NOW).ok, false);
    assert.equal(parseAnalyticsRange({ from: "nope", to: "2026-01-01" }, NOW).ok, false);

    const spanNow = new Date("2030-06-01T00:00:00.000Z");
    const inclusiveEnd = new Date("2030-06-02T00:00:00.000Z");
    const start = new Date(inclusiveEnd.getTime() - 3659 * DAY);
    const allowed = parseAnalyticsRange(
      { from: start.toISOString().slice(0, 10), to: "2030-06-02" },
      spanNow,
    );
    assert.equal(allowed.ok, true);
    const tooLong = parseAnalyticsRange(
      { from: new Date(start.getTime() - DAY).toISOString().slice(0, 10), to: "2030-06-02" },
      spanNow,
    );
    assert.equal(tooLong.ok, false);
  });
});

describe("analytics metric rules", () => {
  it("keeps open, resolved, and rejected disjoint, and withholds a zero rate", () => {
    assert.equal(isOpenStatus(IssueStatus.REOPENED), true);
    assert.equal(isResolvedStatus(IssueStatus.REOPENED), false);
    assert.equal(isResolvedStatus(IssueStatus.CLOSED), true);
    assert.equal(isResolvedStatus(IssueStatus.REJECTED), false);
    assert.equal(isOpenStatus(IssueStatus.REJECTED), false);
    assert.equal(resolutionRate(0, 0), null);
    assert.equal(resolutionRate(0, 4), 0);
    assert.equal(resolutionRate(1, 4), 0.25);
  });

  it("keeps the latest 120 months when a series is longer", () => {
    const rows = Array.from({ length: 121 }, (_, index) => {
      const year = 2000 + Math.floor(index / 12);
      const month = String((index % 12) + 1).padStart(2, "0");
      return { month: `${year}-${month}`, count: 1 };
    });
    const capped = capMonths(rows);
    assert.equal(capped.truncated, true);
    assert.equal(capped.rows.length, 120);
    assert.equal(capped.rows[0]?.month, "2000-02");
    assert.equal(capped.rows.at(-1)?.month, "2010-01");
  });
});

describe("analytics authorization and aggregates", () => {
  it("refuses admin access before reading, including a partial administrator", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const signedOut = await loadAdminAnalytics(null, {}, store, NOW);
    const citizen = await loadAdminAnalytics(
      { userId: "citizen", capabilities: capabilitiesFor(["CITIZEN"], null) },
      {},
      store,
      NOW,
    );
    const partial = await loadAdminAnalytics(
      { userId: "partial", capabilities: new Set([Capability.roleGrant]) },
      {},
      store,
      NOW,
    );
    assert.equal(signedOut.ok, false);
    assert.equal(citizen.ok, false);
    assert.equal(partial.ok, false);
    assert.equal(store.reads, 0);
  });

  it("counts stored reports for an administrator and ignores a requested department", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const result = await loadAdminAnalytics(
      adminAccess,
      { departmentId: "dept-b" },
      store,
      NOW,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(store.lastDepartmentId, null);
    assert.equal(result.report.total, 8);
    assert.equal(result.report.open, 4);
    assert.equal(result.report.resolved, 3);
    assert.equal(result.report.rejected, 1);
    assert.equal(result.report.resolutionRate, 3 / 8);
    assert.equal(result.report.resolutionSample, 2);
    assert.equal(result.report.resolvedMissingTimestamp, 1);
    assert.equal(result.report.averageResolutionSeconds, 13.5 * DAY / 1000);
    assert.deepEqual(
      result.report.byCategory.map((row) => [row.name, row.count]),
      [
        ["Roads", 4],
        ["Drainage", 1],
        ["Lighting", 1],
        ["Parks", 1],
        ["Water", 1],
      ],
    );
    assert.deepEqual(result.report.reportedByMonth, [
      { month: "2026-01", count: 6 },
      { month: "2026-02", count: 1 },
      { month: "2026-03", count: 1 },
    ]);
    assert.deepEqual(result.report.resolvedByMonth, [
      { month: "2026-01", count: 1 },
      { month: "2026-02", count: 1 },
    ]);
    assert.deepEqual(result.report.departments, [
      { name: "Idle", assigned: 0, resolved: 0 },
      { name: "Lighting", assigned: 1, resolved: 1 },
      { name: "Old works (inactive)", assigned: 1, resolved: 0 },
      { name: "Roads", assigned: 5, resolved: 2 },
    ]);
  });

  it("excludes deleted reports from an otherwise empty set", async () => {
    const store = createMemoryAnalyticsStore(
      issues.filter((item) => item.id === "deleted"),
      departments,
    );
    const result = await loadAdminAnalytics(adminAccess, {}, store, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.total, 0);
    assert.equal(result.report.resolved, 0);
    assert.equal(result.report.resolutionRate, null);
    assert.equal(result.report.averageResolutionSeconds, null);
    assert.deepEqual(result.report.byCategory, []);
    assert.deepEqual(result.report.reportedByMonth, []);
  });

  it("returns an unavailable rate for a period with no filings", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const result = await loadAdminAnalytics(
      adminAccess,
      { from: "2024-01-01", to: "2024-01-31" },
      store,
      NOW,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.total, 0);
    assert.equal(result.report.resolutionRate, null);
    assert.equal(result.report.averageResolutionSeconds, null);
    assert.equal(result.report.resolutionSample, 0);
  });

  it("does not read when the date range is invalid", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const result = await loadAdminAnalytics(
      adminAccess,
      { from: "2026-05-01", to: "2026-04-01" },
      store,
      NOW,
    );
    assert.deepEqual(result, { ok: false, reason: "invalid-range" });
    assert.equal(store.reads, 0);
  });

  it("limits department analytics to the signed-in department", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const result = await loadDepartmentAnalytics(
      staffA,
      { departmentId: "dept-b", from: "", to: "" },
      store,
      NOW,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(store.lastDepartmentId, "dept-a");
    assert.equal(result.report.departments, null);
    assert.equal(result.report.total, 5);
    assert.equal(result.report.open, 2);
    assert.equal(result.report.resolved, 2);
    assert.equal(result.report.rejected, 1);
    assert.equal(result.report.resolutionRate, 2 / 5);
    assert.equal(result.report.resolutionSample, 1);
    assert.equal(result.report.resolvedMissingTimestamp, 1);
    assert.equal(result.report.averageResolutionSeconds, (5 * DAY) / 1000);
    assert.equal(result.report.byCategory.some((row) => row.name === "Parks"), false);
    assert.equal(result.report.byCategory.some((row) => row.name === "Water"), false);
  });

  it("refuses a department query before reading when membership is missing", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const signedOut = await loadDepartmentAnalytics(null, { departmentId: "dept-a" }, store, NOW);
    const citizen = await loadDepartmentAnalytics(
      {
        userId: "citizen",
        departmentId: "dept-b",
        capabilities: capabilitiesFor(["CITIZEN"], null),
        mustChangePassword: false,
      },
      { departmentId: "dept-b" },
      store,
      NOW,
    );
    const unlocked = await loadDepartmentAnalytics(
      {
        userId: "staff",
        departmentId: null,
        capabilities: new Set([Capability.departmentWork]),
        mustChangePassword: false,
      },
      { departmentId: "dept-a" },
      store,
      NOW,
    );
    assert.equal(signedOut.ok, false);
    assert.equal(citizen.ok, false);
    if (!citizen.ok) assert.equal(citizen.reason, "forbidden");
    assert.equal(unlocked.ok, false);
    if (!unlocked.ok) assert.equal(unlocked.reason, "forbidden");
    assert.equal(store.reads, 0);
    const password = await loadDepartmentAnalytics(
      { ...staffA, mustChangePassword: true },
      { departmentId: "dept-b" },
      store,
      NOW,
    );
    assert.equal(password.ok, true);
  });

  it("counts a February resolution for a report filed in January without treating it as filed in February", async () => {
    const store = createMemoryAnalyticsStore(issues, departments);
    const result = await loadAdminAnalytics(
      adminAccess,
      { from: "2026-02-01", to: "2026-02-28" },
      store,
      NOW,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.total, 1);
    assert.equal(result.report.resolved, 0);
    assert.equal(result.report.resolutionRate, 0);
    assert.deepEqual(result.report.resolvedByMonth, [{ month: "2026-02", count: 1 }]);
  });
});

describe("analytics month cap through the service", () => {
  it("marks a truncated month series", async () => {
    const reported = Array.from({ length: 121 }, (_, index) => {
      const year = 2000 + Math.floor(index / 12);
      const month = String((index % 12) + 1).padStart(2, "0");
      return { month: `${year}-${month}`, count: 1 };
    });
    let reads = 0;
    const store: AnalyticsStore = {
      async summarize() {
        reads += 1;
        const snapshot: AnalyticsSnapshot = {
          total: 121,
          open: 121,
          resolved: 0,
          rejected: 0,
          resolutionSample: 0,
          resolvedMissingTimestamp: 0,
          averageResolutionSeconds: null,
          byStatus: [],
          byCategory: [],
          reportedByMonth: reported,
          resolvedByMonth: [],
          departments: [],
        };
        return snapshot;
      },
    };
    const result = await loadAdminAnalytics(adminAccess, {}, store, NOW);
    assert.equal(reads, 1);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.monthsTruncated, true);
    assert.equal(result.report.reportedByMonth.length, 120);
    assert.equal(result.report.resolutionRate, 0);
  });
});
