import Link from "next/link";
import { AppPage } from "@/components/app-page";
import { ReportForm } from "@/components/report-form";
import { ISSUE_FORBIDDEN } from "@/lib/issues/messages";
import { loadReportPage } from "@/lib/issues/queries";
import { mapTileConfig } from "@/lib/maps/tiles";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const page = await loadReportPage();
  const tiles = mapTileConfig();

  return (
    <AppPage
      title="Report an issue"
      lede="Describe a civic problem you have seen. A submitted report is saved under your account and starts as reported."
    >
      {page.state === "signed-out" ? (
        <p>
          Sign in with a citizen account to report an issue. <Link href="/login">Log in</Link>
        </p>
      ) : null}
      {page.state === "forbidden" ? <p role="status">{ISSUE_FORBIDDEN}</p> : null}
      {page.state === "unavailable" ? (
        <p role="alert">Reporting is unavailable right now. Try again later.</p>
      ) : null}
      {page.state === "ready" && page.categories.length === 0 ? (
        <p role="status">
          No issue categories are available yet, so a report cannot be submitted.
        </p>
      ) : null}
      {page.state === "ready" && page.categories.length > 0 ? (
        <ReportForm categories={page.categories} tiles={tiles} />
      ) : null}
    </AppPage>
  );
}
