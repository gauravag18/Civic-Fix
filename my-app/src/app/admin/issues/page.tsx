import { redirect } from "next/navigation";
import { AdminDenied, AdminPage, DirectoryBar, EmptyNote, PageLinks, RecordCard, RecordGrid } from "@/components/admin-page";
import { SeverityMark, StatusMark } from "@/components/issue-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhen } from "@/lib/issues/labels";
import { loadAdminIssueBrowser } from "@/lib/issues/admin-issue-queries";
import { loadAdminIssueGate } from "@/lib/issues/delete-queries";
import { isUuid } from "@/lib/issues/validate";

export const dynamic = "force-dynamic";

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const id = (params.id ?? "").trim();
  const gate = await loadAdminIssueGate();
  if (gate.ok && isUuid(id)) redirect(`/admin/issues/${id}`);

  const result = gate.ok ? await loadAdminIssueBrowser(params.q ?? "", params.page) : gate;
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <AdminPage
      title="Reports"
      lede="Open a report to read its status, place, photographs, comments, and history. Deletion stays on that page and still requires the exact title and a reason."
    >
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <DirectoryBar action="/admin/issues" query={result.query}>
            <form action="/admin/issues" method="get" className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
              {id && !isUuid(id) ? (
                <p role="alert" className="text-destructive sm:w-full">
                  Enter the report identifier from its address.
                </p>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="id">Report identifier</Label>
                <Input id="id" name="id" defaultValue={id} autoComplete="off" />
              </div>
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Open identifier
              </Button>
            </form>
          </DirectoryBar>
          {result.total === 0 ? (
            <EmptyNote>No reports match this search.</EmptyNote>
          ) : (
            <RecordGrid>
              {result.items.map((issue) => (
                <RecordCard
                  key={issue.id}
                  href={`/admin/issues/${issue.id}`}
                  title={issue.title}
                  marks={
                    <>
                      <StatusMark status={issue.status} compact />
                      <SeverityMark severity={issue.severity} />
                    </>
                  }
                  facts={[
                    { label: "Category", value: issue.categoryName },
                    { label: "Reporter", value: issue.reporterName },
                    { label: "Department", value: issue.departmentName ?? "None" },
                    { label: "Assignee", value: issue.assigneeName ?? "None" },
                    { label: "Reported", value: `${formatWhen(issue.createdAt)} UTC` },
                    { label: "Record", value: issue.deletedAt ? "Hidden" : "Visible" },
                  ]}
                />
              ))}
            </RecordGrid>
          )}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/issues" query={result.query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
