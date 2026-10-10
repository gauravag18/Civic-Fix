import Link from "next/link";
import { AdminDenied, AdminPage } from "@/components/admin-page";
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
          <nav aria-label="Administration sections" className="text-small">
            <Link href="/admin/departments">Departments</Link>
            {" · "}
            <Link href="/admin/categories">Categories</Link>
            {" · "}
            <Link href="/admin/users">Users</Link>
          </nav>
          <dl className="border border-border text-small">
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Issues</dt>
              <dd>{result.counts.issues}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Active departments</dt>
              <dd>
                {result.counts.activeDepartments}
                <span className="text-muted-foreground"> of {result.counts.departments}</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Department staff memberships</dt>
              <dd>{result.counts.activeMemberships}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Registered users</dt>
              <dd>{result.counts.users}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="font-semibold">Issue categories</dt>
              <dd>
                {result.counts.categories}
                <span className="text-muted-foreground"> ({result.counts.activeCategories} active)</span>
              </dd>
            </div>
          </dl>
          <section className="flex flex-col gap-2">
            <h2 className="text-subsection font-semibold">Issues by status</h2>
            <dl className="border border-border text-small">
              {result.counts.issuesByStatus.map((row) => (
                <div
                  key={row.status}
                  className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <dt>{statusLabel(row.status)}</dt>
                  <dd>{row.count}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : null}
    </AdminPage>
  );
}
