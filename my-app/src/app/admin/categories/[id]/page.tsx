import Link from "next/link";
import { ActiveToggleForm, CategoryEditForm } from "@/components/admin-forms";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { loadAdminCategory } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const saved = (await searchParams).saved;
  const result = await loadAdminCategory(id);

  return (
    <AdminPage title={result.ok ? result.category.name : "Category"}>
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          {saved ? <p role="status">Saved.</p> : null}
          <p className="text-small">
            <Link href="/admin/categories">All categories</Link>
          </p>
          <dl className="border border-border text-small">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Code</dt>
              <dd>{result.category.code}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Status</dt>
              <dd>{result.category.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 px-3 py-2">
              <dt className="font-semibold">Reports</dt>
              <dd>{result.category.issueCount}</dd>
            </div>
          </dl>
          <p className="text-small text-muted-foreground">
            Deactivation hides the category from new reports. Existing reports keep this category.
          </p>
          <CategoryEditForm
            id={result.category.id}
            name={result.category.name}
            sortOrder={result.category.sortOrder}
          />
          <ActiveToggleForm id={result.category.id} isActive={result.category.isActive} kind="category" />
        </>
      ) : null}
    </AdminPage>
  );
}
