import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDenied, AdminPage, PageLinks, SearchForm } from "@/components/admin-page";
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
          <SearchForm action="/admin/issues" query={result.query} />
          <form action="/admin/issues" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {id && !isUuid(id) ? (
              <p role="alert" className="text-destructive sm:w-full">
                Enter the report identifier from its address.
              </p>
            ) : null}
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="id">Report identifier</Label>
              <Input id="id" name="id" defaultValue={id} autoComplete="off" />
            </div>
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              Open identifier
            </Button>
          </form>
          {result.total === 0 ? <p>No reports match this search.</p> : null}
          {result.total > 0 ? (
            <ol className="flex flex-col gap-3">
              {result.items.map((issue) => (
                <li key={issue.id} className="rounded-md border border-border bg-card px-4 py-4">
                  <h2 className="text-subsection font-semibold">
                    <Link href={`/admin/issues/${issue.id}`}>{issue.title}</Link>
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusMark status={issue.status} />
                    <SeverityMark severity={issue.severity} />
                  </p>
                  <p className="mt-2 text-small text-muted-foreground">
                    {issue.categoryName}
                    {" · "}
                    {issue.reporterName}
                    {" · "}
                    {issue.departmentName ?? "No department"}
                    {issue.assigneeName ? ` · ${issue.assigneeName}` : ""}
                    {" · "}
                    <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
                    {issue.deletedAt ? " · Hidden" : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/issues" query={result.query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
