import { AdminDenied, AdminPage, DirectoryBar, EmptyNote, PageLinks, RecordCard, RecordGrid } from "@/components/admin-page";
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
          <DirectoryBar
            action="/admin/departments"
            query={query}
            createHref="/admin/departments/new"
            createLabel="New department"
          />
          {result.total === 0 ? (
            <EmptyNote>
              {query
                ? "No departments match this search."
                : "No departments yet. Create one, then add eligible staff from the department page."}
            </EmptyNote>
          ) : (
            <RecordGrid>
              {result.items.map((department) => (
                <RecordCard
                  key={department.id}
                  href={`/admin/departments/${department.id}`}
                  title={department.name}
                  code={department.code}
                  facts={[
                    { label: "Status", value: department.isActive ? "Active" : "Inactive" },
                    { label: "Staff", value: department.activeMemberships },
                    { label: "Open assignments", value: department.activeAssignments },
                  ]}
                />
              ))}
            </RecordGrid>
          )}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/departments" query={query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
