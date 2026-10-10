import Link from "next/link";
import { AdminDenied, AdminPage, PageLinks, SearchForm } from "@/components/admin-page";
import { loadAdminDepartments } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const result = await loadAdminDepartments(query, params.page);
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <AdminPage title="Departments" lede="Create departments and manage who can work in them.">
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <p className="text-small">
            <Link href="/admin/departments/new">New department</Link>
          </p>
          <SearchForm action="/admin/departments" query={query} />
          {result.total === 0 ? (
            <p>
              {query
                ? "No departments match this search."
                : "No departments yet. Create one, then add eligible staff from the department page."}
            </p>
          ) : null}
          {result.total > 0 ? (
            <ol className="flex flex-col gap-3">
              {result.items.map((department) => (
                <li key={department.id} className="rounded-md border border-border bg-card px-4 py-4">
                  <h2 className="text-subsection font-semibold">
                    <Link href={`/admin/departments/${department.id}`}>{department.name}</Link>
                  </h2>
                  <p className="mt-2 text-small text-muted-foreground">
                    {department.code}
                    {" · "}
                    {department.isActive ? "Active" : "Inactive"}
                    {" · "}
                    {department.activeMemberships} staff
                    {" · "}
                    {department.activeAssignments} open assignments
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/departments" query={query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
