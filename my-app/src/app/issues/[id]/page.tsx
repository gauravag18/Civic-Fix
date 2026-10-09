import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app-page";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { formatWhen, statusLabel } from "@/lib/issues/labels";
import { ISSUE_DETAIL_UNAVAILABLE, ISSUE_SIGN_IN } from "@/lib/issues/messages";
import { loadMyIssue } from "@/lib/issues/queries";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; existing?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { authorization, result } = await loadMyIssue(id);

  if (!result.ok && result.reason === "missing") notFound();
  if (!result.ok && result.reason === "signed-out") {
    return (
      <AppPage title="Report" lede="Sign in to view a report from your account.">
        <p>
          {ISSUE_SIGN_IN} <Link href="/login">Log in</Link>
        </p>
      </AppPage>
    );
  }
  if (!result.ok) {
    return (
      <AppPage title="Report">
        <p role="alert">{ISSUE_DETAIL_UNAVAILABLE}</p>
        <p className="text-small">
          <Link href="/my-issues">My reports</Link>
        </p>
      </AppPage>
    );
  }

  const issue = result.issue;
  const place = [issue.location.locality, issue.location.city, issue.location.postalCode]
    .filter((part): part is string => Boolean(part))
    .join(", ");
  const viewerId = authorization?.userId;

  return (
    <AppPage title={issue.title} lede={issue.categoryName}>
      {query.submitted === "1" ? (
        <p role="status">Your report was submitted.</p>
      ) : null}
      {query.existing === "1" ? (
        <p role="status">This matching report was already submitted.</p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2">
        <StatusMark status={issue.status} />
        <SeverityMark severity={issue.severity} />
      </p>
      <p className="max-w-prose whitespace-pre-wrap text-body">{issue.description}</p>
      <dl className="border border-border text-small">
        <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
          <dt className="font-semibold">Place</dt>
          <dd>{issue.location.description}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
          <dt className="font-semibold">Location</dt>
          <dd>{place}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
          <dt className="font-semibold">Coordinates</dt>
          <dd>
            {issue.location.latitude && issue.location.longitude
              ? `${issue.location.latitude}, ${issue.location.longitude}`
              : "Not provided"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
          <dt className="font-semibold">Reported</dt>
          <dd>
            <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
          </dd>
        </div>
      </dl>
      <section aria-labelledby="comments" className="flex flex-col gap-3">
        <h2 id="comments" className="text-section font-semibold">
          Comments
        </h2>
        {issue.comments.length === 0 ? <p>No department comments yet.</p> : null}
        <ol className="flex flex-col gap-3">
          {issue.comments.map((comment) => (
            <li key={comment.id} className="border-b border-border pb-3">
              <p className="whitespace-pre-wrap">{comment.body}</p>
              <p className="text-small text-muted-foreground">
                {comment.authorName}
                {" · "}
                <time dateTime={comment.createdAt.toISOString()}>
                  {formatWhen(comment.createdAt)} UTC
                </time>
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="status-history" className="flex flex-col gap-3">
        <h2 id="status-history" className="text-section font-semibold">
          Status history
        </h2>
        {issue.history.length === 0 ? <p>No status history is recorded.</p> : null}
        <ol className="flex flex-col gap-3">
          {issue.history.map((entry) => (
            <li key={entry.id} className="border-b border-border pb-3">
              <p className="font-semibold">
                {entry.fromStatus
                  ? `${statusLabel(entry.fromStatus)} to ${statusLabel(entry.toStatus)}`
                  : statusLabel(entry.toStatus)}
              </p>
              <p className="text-small text-muted-foreground">
                <time dateTime={entry.createdAt.toISOString()}>{formatWhen(entry.createdAt)} UTC</time>
                {" · "}
                {entry.changedById === viewerId ? "You" : "CivicFix staff"}
              </p>
              {entry.reason ? <p className="mt-1 text-small">{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>
      <p className="text-small">
        <Link href="/my-issues">My reports</Link>
        {" · "}
        <Link href="/report">Report another issue</Link>
      </p>
    </AppPage>
  );
}
