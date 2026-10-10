import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { departmentChartName, STATUS_ORDER } from "@/lib/analytics/metrics";
import type { AnalyticsScope, AnalyticsSnapshot, AnalyticsStore, MonthCount } from "@/lib/analytics/types";
import { getPrismaClient } from "@/lib/prisma";

type SummaryRow = {
  total: number | string | null;
  open: number | string | null;
  resolved: number | string | null;
  rejected: number | string | null;
  sample: number | string | null;
  missing: number | string | null;
  average_seconds: number | string | null;
};

type StatusRow = { status: string; count: number | string };
type NameCountRow = { name: string; count: number | string };
type MonthRow = { month: string; count: number | string };
type DepartmentRow = {
  name: string;
  active: boolean;
  assigned: number | string;
  resolved: number | string;
};

export function createPrismaAnalyticsStore(): AnalyticsStore {
  return {
    async summarize(scope) {
      const prisma = getPrismaClient();
      const filed = filedWhere(scope);
      const resolved = resolvedWhere(scope);
      const [summary, statuses, categories, reported, resolvedMonths, departments] = await Promise.all([
        prisma.$queryRaw<SummaryRow[]>`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE i.status::text NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')
            )::int AS open,
            COUNT(*) FILTER (
              WHERE i.status::text IN ('RESOLVED', 'CLOSED')
            )::int AS resolved,
            COUNT(*) FILTER (WHERE i.status::text = 'REJECTED')::int AS rejected,
            COUNT(*) FILTER (
              WHERE i.status::text IN ('RESOLVED', 'CLOSED')
                AND i."resolvedAt" IS NOT NULL
                AND i."resolvedAt" >= i."createdAt"
            )::int AS sample,
            COUNT(*) FILTER (
              WHERE i.status::text IN ('RESOLVED', 'CLOSED')
                AND (i."resolvedAt" IS NULL OR i."resolvedAt" < i."createdAt")
            )::int AS missing,
            AVG(EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt"))) FILTER (
              WHERE i.status::text IN ('RESOLVED', 'CLOSED')
                AND i."resolvedAt" IS NOT NULL
                AND i."resolvedAt" >= i."createdAt"
            ) AS average_seconds
          FROM "Issue" i
          WHERE ${filed}
        `,
        prisma.$queryRaw<StatusRow[]>`
          SELECT i.status::text AS status, COUNT(*)::int AS count
          FROM "Issue" i
          WHERE ${filed}
          GROUP BY i.status::text
        `,
        prisma.$queryRaw<NameCountRow[]>`
          SELECT c.name AS name, COUNT(*)::int AS count
          FROM "Issue" i
          INNER JOIN "IssueCategory" c ON c.id = i."categoryId"
          WHERE ${filed}
          GROUP BY c.name
          ORDER BY COUNT(*) DESC, c.name ASC
        `,
        prisma.$queryRaw<MonthRow[]>`
          SELECT to_char(date_trunc('month', i."createdAt"), 'YYYY-MM') AS month,
                 COUNT(*)::int AS count
          FROM "Issue" i
          WHERE ${filed}
          GROUP BY 1
          ORDER BY 1
        `,
        prisma.$queryRaw<MonthRow[]>`
          SELECT to_char(date_trunc('month', i."resolvedAt"), 'YYYY-MM') AS month,
                 COUNT(*)::int AS count
          FROM "Issue" i
          WHERE ${resolved}
          GROUP BY 1
          ORDER BY 1
        `,
        scope.includeDepartments ? departmentRows(scope) : Promise.resolve(null),
      ]);
      const row = summary[0];
      const sample = countOf(row?.sample);
      return {
        total: countOf(row?.total),
        open: countOf(row?.open),
        resolved: countOf(row?.resolved),
        rejected: countOf(row?.rejected),
        resolutionSample: sample,
        resolvedMissingTimestamp: countOf(row?.missing),
        averageResolutionSeconds: sample > 0 ? finiteOrNull(row?.average_seconds) : null,
        byStatus: statusCounts(statuses),
        byCategory: categories.map((item) => ({ name: item.name, count: countOf(item.count) })),
        reportedByMonth: monthCounts(reported),
        resolvedByMonth: monthCounts(resolvedMonths),
        departments,
      } satisfies AnalyticsSnapshot;
    },
  };
}

function filedWhere(scope: AnalyticsScope): Prisma.Sql {
  return Prisma.join(
    [
      Prisma.sql`i."deletedAt" IS NULL`,
      createdBounds(scope),
      assignmentExists(scope.departmentId),
    ].filter((part): part is Prisma.Sql => part !== null),
    " AND ",
  );
}

function resolvedWhere(scope: AnalyticsScope): Prisma.Sql {
  return Prisma.join(
    [
      Prisma.sql`i."deletedAt" IS NULL`,
      Prisma.sql`i.status::text IN ('RESOLVED', 'CLOSED')`,
      Prisma.sql`i."resolvedAt" IS NOT NULL`,
      Prisma.sql`i."resolvedAt" >= i."createdAt"`,
      resolvedBounds(scope),
      assignmentExists(scope.departmentId),
    ].filter((part): part is Prisma.Sql => part !== null),
    " AND ",
  );
}

function createdBounds(scope: AnalyticsScope): Prisma.Sql | null {
  if (scope.range.kind === "all") return null;
  return Prisma.sql`i."createdAt" >= ${scope.range.from} AND i."createdAt" < ${scope.range.to}`;
}

function resolvedBounds(scope: AnalyticsScope): Prisma.Sql | null {
  if (scope.range.kind === "all") return null;
  return Prisma.sql`i."resolvedAt" >= ${scope.range.from} AND i."resolvedAt" < ${scope.range.to}`;
}

function assignmentExists(departmentId: string | null): Prisma.Sql | null {
  if (!departmentId) return null;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "IssueAssignment" a
    WHERE a."issueId" = i.id
      AND a."departmentId" = ${departmentId}::uuid
      AND a."endedAt" IS NULL
  )`;
}

async function departmentRows(scope: AnalyticsScope): Promise<AnalyticsSnapshot["departments"]> {
  const created =
    scope.range.kind === "span"
      ? Prisma.sql`AND i."createdAt" >= ${scope.range.from} AND i."createdAt" < ${scope.range.to}`
      : Prisma.sql``;
  const rows = await getPrismaClient().$queryRaw<DepartmentRow[]>`
    SELECT
      d.name AS name,
      d."isActive" AS active,
      COUNT(i.id)::int AS assigned,
      COUNT(i.id) FILTER (WHERE i.status::text IN ('RESOLVED', 'CLOSED'))::int AS resolved
    FROM "Department" d
    LEFT JOIN "IssueAssignment" a
      ON a."departmentId" = d.id AND a."endedAt" IS NULL
    LEFT JOIN "Issue" i
      ON i.id = a."issueId" AND i."deletedAt" IS NULL ${created}
    GROUP BY d.id, d.name, d."isActive"
    HAVING d."isActive" = true OR COUNT(i.id) > 0
  `;
  return rows
    .map((row) => ({
      name: departmentChartName(row.name, row.active === true),
      assigned: countOf(row.assigned),
      resolved: countOf(row.resolved),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function statusCounts(rows: readonly StatusRow[]): AnalyticsSnapshot["byStatus"] {
  const counts = new Map(rows.map((row) => [row.status, countOf(row.count)]));
  return STATUS_ORDER.flatMap((status) => {
    const count = counts.get(status) ?? 0;
    return count > 0 ? [{ status, count }] : [];
  });
}

function monthCounts(rows: readonly MonthRow[]): MonthCount[] {
  return rows
    .filter((row) => /^\d{4}-\d{2}$/.test(row.month))
    .map((row) => ({ month: row.month, count: countOf(row.count) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function countOf(value: number | string | null | undefined): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.trunc(number);
}

function finiteOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
