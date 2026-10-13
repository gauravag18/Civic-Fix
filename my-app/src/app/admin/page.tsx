import { AdminDenied, AdminPage, StatCard, StatGrid } from "@/components/admin-page";
import { statusLabel } from "@/lib/issues/labels";
import { loadAdminDashboard } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const result = await loadAdminDashboard();

  return (
    <AdminPage
      title="Administration"
      lede="Counts come from the database. They are shown only after the server confirms administrator access."
    >
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <StatGrid>
            <StatCard label="Reports" value={result.counts.issues} />
            <StatCard
              label="Departments"
              value={result.counts.activeDepartments}
              note={`${result.counts.departments} in total`}
            />
            <StatCard label="Staff memberships" value={result.counts.activeMemberships} />
            <StatCard label="Users" value={result.counts.users} />
            <StatCard
              label="Categories"
              value={result.counts.categories}
              note={`${result.counts.activeCategories} active`}
            />
          </StatGrid>
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Reports by status</h2>
            <StatGrid>
              {result.counts.issuesByStatus.map((row) => (
                <StatCard key={row.status} label={statusLabel(row.status)} value={row.count} />
              ))}
            </StatGrid>
          </section>
        </>
      ) : null}
    </AdminPage>
  );
}
