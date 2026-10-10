import Link from "next/link";
import { AnalyticsChartPanel } from "@/components/analytics-chart-panel";
import { AnalyticsDefinitions } from "@/components/analytics-definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration, formatRange, formatRate, METRIC_NOTES } from "@/lib/analytics/metrics";
import type { AnalyticsReport, MonthCount } from "@/lib/analytics/types";
import { statusLabel } from "@/lib/issues/labels";

export function AnalyticsFilter({
  path,
  from,
  to,
}: {
  path: string;
  from: string;
  to: string;
}) {
  return (
    <form method="get" action={path} className="flex flex-col gap-3">
      <p className="text-small text-muted-foreground" id="analytics-range-help">
        Choose both dates, or use all time. Dates are UTC calendar days and include the end date. A
        range can start in 2020 and cover at most 10 years, through tomorrow (UTC).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small font-semibold" htmlFor="analytics-from">
          From
          <Input id="analytics-from" name="from" type="date" defaultValue={from} aria-describedby="analytics-range-help" />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small font-semibold" htmlFor="analytics-to">
          To
          <Input id="analytics-to" name="to" type="date" defaultValue={to} aria-describedby="analytics-range-help" />
        </label>
        <Button type="submit">Apply range</Button>
        <Link href={path} className="inline-flex h-10 items-center text-small font-semibold">
          All time
        </Link>
      </div>
    </form>
  );
}

export function AnalyticsView({ report }: { report: AnalyticsReport }) {
  const months = mergeMonths(report.reportedByMonth, report.resolvedByMonth);
  const statuses = report.byStatus.map((row) => ({ name: statusLabel(row.status), count: row.count }));
  const filedEmpty = report.total === 0;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-small text-muted-foreground">
        Filing period: {formatRange(report.range)}. Totals, status, category, and the filed series use
        the creation date. The resolved series uses the resolution date.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric term="Total issues" value={String(report.total)} />
        <Metric term="Open issues" value={String(report.open)} />
        <Metric term="Resolved issues" value={String(report.resolved)} />
        <Metric term="Resolution rate" value={formatRate(report.resolutionRate)} />
        <Metric term="Rejected" value={String(report.rejected)} />
        <Metric term="Average resolution time" value={formatDuration(report.averageResolutionSeconds)} />
      </dl>
      <p className="text-small text-muted-foreground">
        {report.resolutionSample === 0
          ? "No resolved or closed report in this filing period has a usable resolution time."
          : `Average based on ${report.resolutionSample} resolved or closed ${report.resolutionSample === 1 ? "report" : "reports"} with a usable resolution time.`}
        {report.resolvedMissingTimestamp > 0
          ? ` ${report.resolvedMissingTimestamp} resolved or closed ${report.resolvedMissingTimestamp === 1 ? "report lacks" : "reports lack"} a usable resolution time and ${report.resolvedMissingTimestamp === 1 ? "is" : "are"} left out of the average.`
          : ""}
      </p>
      {filedEmpty && months.every((row) => row.resolved === 0) ? (
        <p role="status">No reports were filed in this period.</p>
      ) : null}
      {filedEmpty && months.some((row) => row.resolved > 0) ? (
        <p role="status">
          No reports were filed in this period. Resolutions below follow the resolution date and can
          belong to reports filed earlier.
        </p>
      ) : null}
      <AnalyticsChartPanel
        months={months}
        categories={report.byCategory}
        statuses={statuses}
        departments={report.departments}
      />
      <CountTable
        caption="Reports and resolutions by month"
        columns={["Month", "Filed", "Resolved"]}
        rows={months.map((row) => [row.month, String(row.reported), String(row.resolved)])}
        empty="No months to show."
      />
      {report.monthsTruncated ? (
        <p className="text-small text-muted-foreground">The month charts show the latest 120 months.</p>
      ) : null}
      <CountTable
        caption="Reports by category"
        columns={["Category", "Reports"]}
        rows={report.byCategory.map((row) => [row.name, String(row.count)])}
        empty="No categories to show."
      />
      <CountTable
        caption="Reports by current status"
        columns={["Status", "Reports"]}
        rows={statuses.map((row) => [row.name, String(row.count)])}
        empty="No statuses to show."
      />
      {report.departments ? (
        <CountTable
          caption="Current department assignments"
          columns={["Department", "Currently assigned", "Resolved or closed"]}
          rows={report.departments.map((row) => [row.name, String(row.assigned), String(row.resolved)])}
          empty="No departments to show."
        />
      ) : null}
      <AnalyticsDefinitions notes={METRIC_NOTES} />
    </div>
  );
}

function Metric({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <dt className="text-small text-muted-foreground">{term}</dt>
      <dd className="text-subsection font-semibold">{value}</dd>
    </div>
  );
}

function CountTable({
  caption,
  columns,
  rows,
  empty,
}: {
  caption: string;
  columns: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full min-w-[20rem] border-collapse text-small">
        <caption className="px-3 py-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="border-t border-border">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-3 py-2 text-left font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-2 text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.join("|")} className="border-t border-border">
                {row.map((cell, index) => (
                  <td key={`${cell}-${index}`} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function mergeMonths(reported: readonly MonthCount[], resolved: readonly MonthCount[]) {
  const months = new Map<string, { month: string; reported: number; resolved: number }>();
  for (const row of reported) {
    months.set(row.month, { month: row.month, reported: row.count, resolved: 0 });
  }
  for (const row of resolved) {
    const current = months.get(row.month) ?? { month: row.month, reported: 0, resolved: 0 };
    current.resolved = row.count;
    months.set(row.month, current);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
