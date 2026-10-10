import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app-page";
import { AssignmentForm, CommentForm, StatusForm } from "@/components/department-forms";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { IssuePhotos } from "@/components/issue-photos";
import { formatWhen, statusLabel } from "@/lib/issues/labels";
import { STAFF_FORBIDDEN, STAFF_PASSWORD, STAFF_SIGN_IN, STAFF_UNAVAILABLE } from "@/lib/issues/messages";
import { loadDepartmentIssue } from "@/lib/issues/staff-queries";

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
  const result = await loadDepartmentIssue(id);

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
  if (!result.ok && result.reason === "password") {
    return (
      <AppPage area="department" title="Department report">
        <p>
          {STAFF_PASSWORD} <Link href="/account/password">Change password</Link>
        </p>
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
      {updated ? <p role="status">{updated}</p> : null}
      <p className="flex flex-wrap items-center gap-2">
        <StatusMark status={issue.status} />
        <SeverityMark severity={issue.severity} />
      </p>
      <p className="max-w-prose whitespace-pre-wrap text-body">{issue.description}</p>
      <IssuePhotos images={issue.images} />
      <dl className="border border-border text-small">
        <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
          <dt className="font-semibold">Place</dt>
          <dd>{issue.location.description}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
          <dt className="font-semibold">City</dt>
          <dd>{issue.location.city}</dd>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:justify-between">
          <dt className="font-semibold">Assignment</dt>
          <dd>
            {issue.assignment
              ? (issue.assignment.assigneeName ?? "Department queue")
              : "Not assigned"}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="assignment-heading" className="flex flex-col gap-3">
        <h2 id="assignment-heading" className="text-section font-semibold">
          Assignment
        </h2>
        <AssignmentForm
          issueId={issue.id}
          members={result.members}
          assigneeId={issue.assignment?.assigneeId ?? null}
        />
      </section>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="text-section font-semibold">
          Status
        </h2>
        {issue.assignment ? (
          <StatusForm issueId={issue.id} transitions={result.transitions} />
        ) : (
          <p>Take the report into your department before changing its status.</p>
        )}
      </section>

      <section aria-labelledby="comment-heading" className="flex flex-col gap-3">
        <h2 id="comment-heading" className="text-section font-semibold">
          Comments
        </h2>
        {issue.comments.length === 0 ? <p>No comments yet.</p> : null}
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
        {issue.assignment ? <CommentForm issueId={issue.id} /> : null}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-section font-semibold">
          Status history
        </h2>
        <ol className="flex flex-col gap-3">
          {issue.history.map((entry) => (
            <li key={entry.id}>
              <p className="font-semibold">
                {entry.fromStatus
                  ? `${statusLabel(entry.fromStatus)} to ${statusLabel(entry.toStatus)}`
                  : statusLabel(entry.toStatus)}
              </p>
              <p className="text-small text-muted-foreground">
                <time dateTime={entry.createdAt.toISOString()}>{formatWhen(entry.createdAt)} UTC</time>
              </p>
              {entry.reason ? <p className="text-small">{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>
      <p className="text-small">
        <Link href="/department">Department queue</Link>
      </p>
    </AppPage>
  );
}
