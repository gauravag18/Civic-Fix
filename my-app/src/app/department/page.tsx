import Link from "next/link";
import { AppPage } from "@/components/app-page";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { formatWhen } from "@/lib/issues/labels";
import { STAFF_FORBIDDEN, STAFF_SIGN_IN, STAFF_UNAVAILABLE } from "@/lib/issues/messages";
import { loadDepartmentQueue } from "@/lib/issues/staff-queries";
import type { QueueKind } from "@/lib/issues/staff-service";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const params = await searchParams;
  const kind: QueueKind = params.view === "unassigned" ? "unassigned" : "assigned";
  const result = await loadDepartmentQueue(kind, params.page);
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const pageQuery = (page: number) => {
    const search = new URLSearchParams();
    if (kind === "unassigned") search.set("view", "unassigned");
    if (page > 1) search.set("page", String(page));
    const value = search.toString();
    return value ? `/department?${value}` : "/department";
  };

  return (
    <AppPage area="department"
      title={kind === "assigned" ? "Assigned reports" : "Reports to take"}
      lede={
        kind === "assigned"
          ? "Reports already assigned to your department. Open one to update it."
          : "Reports your department can take. Open one, then assign it before changing its status."
      }
    >
      <nav aria-label="Queue" className="flex flex-wrap gap-2">
        <Link
          href="/department"
          aria-current={kind === "assigned" ? "page" : undefined}
          className={kind === "assigned" ? "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground no-underline" : "rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold no-underline"}
        >
          Assigned
        </Link>
        <Link
          href="/department?view=unassigned"
          aria-current={kind === "unassigned" ? "page" : undefined}
          className={kind === "unassigned" ? "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground no-underline" : "rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold no-underline"}
        >
          Available to take
        </Link>
      </nav>
      {!result.ok && result.reason === "signed-out" ? (
        <p>
          {STAFF_SIGN_IN} <Link href="/login">Log in</Link>
        </p>
      ) : null}
      {!result.ok && result.reason === "forbidden" ? <p role="status">{STAFF_FORBIDDEN}</p> : null}
      {!result.ok && result.reason === "unavailable" ? (
        <p role="alert">{STAFF_UNAVAILABLE}</p>
      ) : null}
      {result.ok && result.total === 0 ? (
        <p>
          {kind === "assigned"
            ? "No reports are assigned to your department."
            : "No unassigned reports can be taken."}
        </p>
      ) : null}
      {result.ok && result.total > 0 ? (
        <>
          <ol className="flex flex-col gap-3">
            {result.items.map((issue) => (
              <li key={issue.id} className="rounded-md border border-border bg-card px-4 py-4">
                <h2 className="text-subsection font-semibold">
                  <Link href={`/department/issues/${issue.id}`}>{issue.title}</Link>
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusMark status={issue.status} />
                  <SeverityMark severity={issue.severity} />
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  {issue.categoryName}
                  {" · "}
                  {issue.city}
                  {" · "}
                  <time dateTime={issue.createdAt.toISOString()}>
                    {formatWhen(issue.createdAt)} UTC
                  </time>
                </p>
              </li>
            ))}
          </ol>
          <nav aria-label="Pages" className="flex flex-wrap items-center gap-4 text-small">
            <p>
              Page {result.page} of {lastPage}
            </p>
            {result.page > 1 ? <Link href={pageQuery(result.page - 1)}>Previous</Link> : null}
            {result.page < lastPage ? <Link href={pageQuery(result.page + 1)}>Next</Link> : null}
          </nav>
        </>
      ) : null}
    </AppPage>
  );
}
