"use client";

import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ink = "#34251D";
const link = "#654737";
const accent = "#A65F43";
const grid = "#E4D8C8";

const tooltipStyle = {
  background: "#FFFCF6",
  border: "1px solid #E4D8C8",
  borderRadius: 6,
  color: ink,
};

type MonthPoint = { month: string; reported: number; resolved: number };
type NamedCount = { name: string; count: number };
type DepartmentPoint = { name: string; assigned: number; resolved: number };

export type AnalyticsChartData = {
  months: MonthPoint[];
  categories: NamedCount[];
  statuses: NamedCount[];
  departments: DepartmentPoint[] | null;
};

export function AnalyticsCharts({
  months,
  categories,
  statuses,
  departments,
}: AnalyticsChartData) {
  return (
    <div className="flex flex-col gap-6">
      {months.length > 0 ? (
        <ChartFrame title="Reports and resolutions by month" height={280}>
          <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: ink, fontSize: 12 }}
              interval={months.length > 8 ? "preserveStartEnd" : 0}
              minTickGap={12}
            />
            <YAxis allowDecimals={false} tick={{ fill: ink, fontSize: 12 }} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="reported" name="Filed" fill={ink} radius={[2, 2, 0, 0]} />
            <Bar dataKey="resolved" name="Resolved" fill={accent} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartFrame>
      ) : null}
      {categories.length > 0 ? (
        <ChartFrame title="Reports by category" height={Math.max(180, categories.length * 36)}>
          <BarChart
            data={categories}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: ink, fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={128}
              tick={{ fill: ink, fontSize: 12 }}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" name="Reports" fill={link} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ChartFrame>
      ) : null}
      {statuses.length > 0 ? (
        <ChartFrame title="Reports by current status" height={Math.max(180, statuses.length * 36)}>
          <BarChart data={statuses} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: ink, fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={128} tick={{ fill: ink, fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" name="Reports" fill={ink} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ChartFrame>
      ) : null}
      {departments && departments.length > 0 ? (
        <ChartFrame title="Current department assignments" height={Math.max(200, departments.length * 42)}>
          <BarChart
            data={departments}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: ink, fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: ink, fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="assigned" name="Currently assigned" fill={link} radius={[0, 2, 2, 0]} />
            <Bar dataKey="resolved" name="Resolved or closed" fill={accent} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ChartFrame>
      ) : null}
    </div>
  );
}

function ChartFrame({
  title,
  height,
  children,
}: {
  title: string;
  height: number;
  children: ReactElement;
}) {
  return (
    <figure className="min-w-0" aria-hidden="true">
      <figcaption className="mb-2 text-small font-semibold">{title}</figcaption>
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
