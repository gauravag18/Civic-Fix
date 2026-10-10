import Link from "next/link";
import { AppPage } from "@/components/app-page";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { ISSUE_LIST_UNAVAILABLE, ISSUE_SIGN_IN } from "@/lib/issues/messages";
import { formatWhen } from "@/lib/issues/labels";
import { loadMyIssues } from "@/lib/issues/queries";

export const dynamic = "force-dynamic";

export default async function MyIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const result = await loadMyIssues(params.page);
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <AppPage title="My reports" lede="Reports submitted from this account.">
      {!result.ok && result.reason === "signed-out" ? (
        <p>
          {ISSUE_SIGN_IN} <Link href="/login">Log in</Link>
        </p>
      ) : null}
      {!result.ok && result.reason === "unavailable" ? (
        <p role="alert">{ISSUE_LIST_UNAVAILABLE}</p>
      ) : null}
      {result.ok && result.total === 0 ? (
        <p>
          You have not reported an issue. <Link href="/report">Report an issue</Link>
        </p>
      ) : null}
      {result.ok && result.total > 0 ? (
        <>
          <ol className="flex flex-col gap-3">
            {result.items.map((issue) => (
              <li key={issue.id} className="rounded-md border border-border bg-card px-4 py-4">
                <h2 className="text-subsection font-semibold">
                  <Link href={`/issues/${issue.id}`}>{issue.title}</Link>
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
                  <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
                </p>
              </li>
            ))}
          </ol>
          <nav aria-label="Pages" className="flex flex-wrap items-center gap-4 text-small">
            <p>
              Page {result.page} of {lastPage}
            </p>
            {result.page > 1 ? (
              <Link href={result.page === 2 ? "/my-issues" : `/my-issues?page=${result.page - 1}`}>
                Previous
              </Link>
            ) : null}
            {result.page < lastPage ? (
              <Link href={`/my-issues?page=${result.page + 1}`}>Next</Link>
            ) : null}
          </nav>
        </>
      ) : null}
    </AppPage>
  );
}
