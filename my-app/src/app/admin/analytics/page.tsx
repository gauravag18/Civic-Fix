import { AdminDenied, AdminPage } from "@/components/admin-page";
import { AnalyticsFilter, AnalyticsView } from "@/components/analytics-view";
import { loadAdminAnalyticsPage } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; departmentId?: string }>;
}) {
  const params = await searchParams;
  const result = await loadAdminAnalyticsPage({
    from: params.from,
    to: params.to,
    departmentId: params.departmentId,
  });

  return (
    <AdminPage
      title="Analytics"
      lede="Counts come from stored reports. Deleted reports are excluded. Department bars use the assignment that is active now."
    >
      {result.ok || result.reason === "invalid-range" ? (
        <AnalyticsFilter path="/admin/analytics" from={params.from ?? ""} to={params.to ?? ""} />
      ) : (
        <AdminDenied reason={result.reason} />
      )}
      {!result.ok && result.reason === "invalid-range" ? (
        <p role="alert">
          Enter both dates, with the start on or before the end. Use dates from 2020 through tomorrow
          (UTC), spanning at most 10 years.
        </p>
      ) : null}
      {result.ok ? <AnalyticsView report={result.report} /> : null}
    </AdminPage>
  );
}
