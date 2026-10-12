import Link from "next/link";
import { AnalyticsFilter, AnalyticsView } from "@/components/analytics-view";
import { AppPage } from "@/components/app-page";
import { loadDepartmentAnalyticsPage } from "@/lib/analytics/queries";
import { STAFF_FORBIDDEN, STAFF_SIGN_IN, STAFF_UNAVAILABLE } from "@/lib/issues/messages";

export const dynamic = "force-dynamic";

export default async function DepartmentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; departmentId?: string }>;
}) {
  const params = await searchParams;
  const result = await loadDepartmentAnalyticsPage({
    from: params.from,
    to: params.to,
    departmentId: params.departmentId,
  });

  return (
    <AppPage
      area="department"
      title="Department analytics"
      lede="Counts cover reports currently assigned to your department. Another department’s reports are not included."
    >
      {!result.ok && result.reason === "signed-out" ? (
        <p>
          {STAFF_SIGN_IN} <Link href="/login">Log in</Link>
        </p>
      ) : null}
      {!result.ok && result.reason === "forbidden" ? <p role="status">{STAFF_FORBIDDEN}</p> : null}
      {!result.ok && result.reason === "unavailable" ? <p role="alert">{STAFF_UNAVAILABLE}</p> : null}
      {result.ok || result.reason === "invalid-range" ? (
        <AnalyticsFilter path="/department/analytics" from={params.from ?? ""} to={params.to ?? ""} />
      ) : null}
      {!result.ok && result.reason === "invalid-range" ? (
        <p role="alert">
          Enter both dates, with the start on or before the end. Use dates from 2020 through tomorrow
          (UTC), spanning at most 10 years.
        </p>
      ) : null}
      {result.ok ? <AnalyticsView report={result.report} /> : null}
    </AppPage>
  );
}
