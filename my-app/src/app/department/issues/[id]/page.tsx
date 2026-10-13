import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app-page";
import { AssignmentForm, CommentForm, StatusForm } from "@/components/department-forms";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { IssuePhotos } from "@/components/issue-photos";
import { getAuthorization } from "@/lib/auth/authorization";
import { formatWhen, statusLabel } from "@/lib/issues/labels";
import { STAFF_FORBIDDEN, STAFF_SIGN_IN, STAFF_UNAVAILABLE } from "@/lib/issues/messages";
import { loadDepartmentIssue } from "@/lib/issues/staff-queries";
import type { StatusHistoryEntry } from "@/lib/issues/types";

export const dynamic = "force-dynamic";

export default async function DepartmentIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [authorization, result] = await Promise.all([getAuthorization(), loadDepartmentIssue(id)]);

  if (!result.ok && result.reason === "missing") notFound();
  if (!result.ok && result.reason === "signed-out") {
    return (
      <AppPage area="department" title="Department report" lede="Sign in to open a department report.">
        <p>
          {STAFF_SIGN_IN} <Link href="/login">Log in</Link>
        </p>
      </AppPage>
    );
  }
  if (!result.ok && result.reason === "forbidden") {
    return (
      <AppPage area="department" title="Department report">
        <p role="status">{STAFF_FORBIDDEN}</p>
      </AppPage>
    );
  }
  if (!result.ok) {
    return (
      <AppPage area="department" title="Department report">
        <p role="alert">{STAFF_UNAVAILABLE}</p>
      </AppPage>
    );
  }

  const issue = result.issue;
  const place = [issue.location.locality, issue.location.city, issue.location.postalCode]
    .filter((part): part is string => Boolean(part))
    .join(", ");
  const updated =
    query.updated === "status"
      ? "Status updated. The reporter can see this status."
      : query.updated === "comment"
        ? "Comment added. The reporter can read it."
        : query.updated === "assignment"
          ? "Assignment saved."
          : "";

  return (
    <AppPage area="department" title={issue.title} lede={issue.categoryName}>
      {updated ? <p role="status" className="text-small text-muted-foreground">{updated}</p> : null}
      <div className="grid items-start gap-8 lg:grid-cols-[2fr_1fr] lg:gap-x-10 lg:gap-y-10">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="flex flex-wrap items-center gap-2">
            <StatusMark status={issue.status} />
            <SeverityMark severity={issue.severity} />
          </p>
          <p className="mt-3 text-small text-muted-foreground">
            Reported{" "}
            <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
            {" · "}
            {issue.assignment
              ? (issue.assignment.assigneeName ?? "Department queue")
              : "Not assigned"}
          </p>
          <p className="mt-4 max-w-prose whitespace-pre-wrap text-body">{issue.description}</p>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <IssuePhotos images={issue.images} layout="stack" />
          <div>
            <h2 className="text-small font-semibold">Location</h2>
            <p className="mt-1">{issue.location.description}</p>
            {place ? <p className="text-small text-muted-foreground">{place}</p> : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-10 lg:col-start-1">
          <section aria-labelledby="assignment-heading" className="flex flex-col gap-4">
            <h2 id="assignment-heading" className="text-section font-semibold">
              Assignment
            </h2>
            <AssignmentForm
              issueId={issue.id}
              members={result.members}
              assigneeId={issue.assignment?.assigneeId ?? null}
            />
          </section>

          <section aria-labelledby="status-heading" className="flex flex-col gap-4">
            <h2 id="status-heading" className="text-section font-semibold">
              Status
            </h2>
            {issue.assignment ? (
              <StatusForm issueId={issue.id} transitions={result.transitions} />
            ) : (
              <p className="text-muted-foreground">
                Take the report into your department before changing its status.
              </p>
            )}
          </section>

          <section aria-labelledby="comment-heading" className="flex flex-col gap-4">
            <h2 id="comment-heading" className="text-section font-semibold">
              Comments
            </h2>
            {issue.comments.length === 0 ? (
              <p className="text-muted-foreground">No comments yet.</p>
            ) : (
              <ol className="flex flex-col gap-6">
                {issue.comments.map((comment) => (
                  <li key={comment.id}>
                    <p className="text-small">
                      <span className="font-semibold text-foreground">{comment.authorName}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        <time dateTime={comment.createdAt.toISOString()}>
                          {formatWhen(comment.createdAt)} UTC
                        </time>
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {issue.assignment ? <CommentForm issueId={issue.id} /> : null}
          </section>

          <section aria-labelledby="history-heading" className="flex flex-col gap-4">
            <h2 id="history-heading" className="text-section font-semibold">
              Status history
            </h2>
            {issue.history.length === 0 ? (
              <p className="text-muted-foreground">No status history is recorded.</p>
            ) : (
              <StatusTimeline history={issue.history} viewerId={authorization?.userId} />
            )}
          </section>

          <p className="text-small">
            <Link href="/department">Queue</Link>
          </p>
        </div>
      </div>
    </AppPage>
  );
}

function StatusTimeline({
  history,
  viewerId,
}: {
  history: StatusHistoryEntry[];
  viewerId: string | undefined;
}) {
  return (
    <ol className="flex flex-col">
      {history.map((entry, index) => {
        const latest = index === history.length - 1;
        const label = entry.fromStatus
          ? `${statusLabel(entry.fromStatus)} to ${statusLabel(entry.toStatus)}`
          : statusLabel(entry.toStatus);
        return (
          <li key={entry.id} className="flex gap-4">
            <span className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
              <span className={`mt-1.5 size-2.5 rounded-full ${latest ? "bg-accent" : "bg-border"}`} />
              {latest ? null : <span className="mt-1 w-px flex-1 bg-border" />}
            </span>
            <div className={latest ? "" : "pb-6"}>
              <p className="font-semibold">{label}</p>
              <p className="text-small text-muted-foreground">
                <time dateTime={entry.createdAt.toISOString()}>{formatWhen(entry.createdAt)} UTC</time>
                {" · "}
                {entry.changedById === viewerId ? "You" : "CivicFix staff"}
              </p>
              {entry.reason ? <p className="mt-1 text-small">{entry.reason}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
