"use client";

import dynamic from "next/dynamic";
import type { AnalyticsChartData } from "@/components/analytics-charts";

const AnalyticsCharts = dynamic(
  () => import("@/components/analytics-charts").then((module) => module.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="text-small text-muted-foreground">
        Loading charts
      </p>
    ),
  },
);

export function AnalyticsChartPanel(props: AnalyticsChartData) {
  return <AnalyticsCharts {...props} />;
}
