import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { IssueDeleteForm } from "@/components/admin-issue-delete";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { IssuePhotos } from "@/components/issue-photos";
import { DELETE_ALREADY, DELETE_DONE, DELETE_PHOTOS } from "@/lib/admin/messages";
import { loadAdminIssueInspection } from "@/lib/issues/admin-issue-queries";
import { loadAdminIssueForDeletion } from "@/lib/issues/delete-queries";
import { formatWhen, statusLabel } from "@/lib/issues/labels";
import { isUuid } from "@/lib/issues/validate";

export const dynamic = "force-dynamic";

export default async function AdminIssueDeletionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) redirect("/admin/issues");
  const done = (await searchParams).done;
  const [inspection, deletion] = await Promise.all([
    loadAdminIssueInspection(id),
    loadAdminIssueForDeletion(id),
  ]);
  const notice =
    done === "deleted" ? DELETE_DONE : done === "already" ? DELETE_ALREADY : done === "retry" ? DELETE_PHOTOS : "";
  const issue = inspection.ok ? inspection.issue : null;
  const place = issue
    ? [issue.location.locality, issue.location.city, issue.location.postalCode].filter((part): part is string => Boolean(part)).join(", ")
    : "";

  return (
    <AdminPage
      title={issue ? issue.title : "Report"}
      lede="Review the report, then delete it only by typing its title and a reason."
    >
      {!inspection.ok ? <AdminDenied reason={inspection.reason} /> : null}
      {issue ? (
        <>
          <p className="text-small">
            <Link href="/admin/issues">All reports</Link>
          </p>
          {notice ? <p role="status">{notice}</p> : null}
          <p className="flex flex-wrap items-center gap-2">
            <StatusMark status={issue.status} />
            <SeverityMark severity={issue.severity} />
          </p>
          <p className="max-w-prose whitespace-pre-wrap text-body">{issue.description}</p>
          <dl className="border border-border text-small">
            <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Category</dt>
              <dd>{issue.categoryName}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Reported by</dt>
              <dd>{issue.reporterName}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Department</dt>
              <dd>
                {issue.departmentName
                  ? issue.assigneeName
                    ? `${issue.departmentName} · ${issue.assigneeName}`
                    : issue.departmentName
                  : "Not assigned"}
              </dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Place</dt>
              <dd>{issue.location.description}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Location</dt>
              <dd>{place}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-border px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Reported</dt>
              <dd>
                <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="font-semibold">Visibility</dt>
              <dd>{issue.deletedAt ? "Hidden" : "Visible"}</dd>
            </div>
          </dl>
          {issue.images.length === 0 ? (
            <p>No photographs are attached.</p>
          ) : (
            <>
              <p className="text-small text-muted-foreground">
                A photograph loads only when this account is already allowed to read it.
              </p>
              <IssuePhotos images={issue.images} />
            </>
          )}
          <section aria-labelledby="comments" className="flex flex-col gap-3">
            <h2 id="comments" className="text-section font-semibold">
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
                    <time dateTime={comment.createdAt.toISOString()}>{formatWhen(comment.createdAt)} UTC</time>
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
                  </p>
                  {entry.reason ? <p className="text-small">{entry.reason}</p> : null}
                </li>
              ))}
            </ol>
          </section>
          {deletion.ok && !deletion.issue.storageCleared ? (
            <section aria-labelledby="delete-report" className="flex flex-col gap-3">
              <h2 id="delete-report" className="text-section font-semibold">
                Delete this report
              </h2>
              <IssueDeleteForm issueId={deletion.issue.id} retry={deletion.issue.deletedAt !== null} />
            </section>
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
