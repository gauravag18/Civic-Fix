import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { IssueDeleteForm } from "@/components/admin-issue-delete";
import { DELETE_ALREADY, DELETE_DONE, DELETE_PHOTOS } from "@/lib/admin/messages";
import { statusLabel } from "@/lib/issues/labels";
import { loadAdminIssueForDeletion } from "@/lib/issues/delete-queries";
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
  const result = await loadAdminIssueForDeletion(id);
  const notice =
    done === "deleted" ? DELETE_DONE : done === "already" ? DELETE_ALREADY : done === "retry" ? DELETE_PHOTOS : "";

  return (
    <AdminPage
      title={result.ok ? result.issue.title : "Delete a report"}
      lede="Hiding a report removes it from citizen, department, Explore, and analytics views. Comments, status history, and the audit record stay. Photographs are removed from private storage after the audit is saved."
    >
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <p className="text-small">
            <Link href="/admin/issues">Find another report</Link>
          </p>
          {notice ? <p role="status">{notice}</p> : null}
          <dl className="overflow-hidden rounded-md border border-border bg-card text-small">
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Title</dt>
              <dd>{result.issue.title}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Status</dt>
              <dd>{statusLabel(result.issue.status)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Photographs</dt>
              <dd>{result.issue.imageCount}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="font-semibold">Visibility</dt>
              <dd>{result.issue.deletedAt ? "Hidden" : "Visible"}</dd>
            </div>
          </dl>
          {result.issue.storageCleared ? null : (
            <IssueDeleteForm issueId={result.issue.id} retry={result.issue.deletedAt !== null} />
          )}
        </>
      ) : null}
    </AdminPage>
  );
}
