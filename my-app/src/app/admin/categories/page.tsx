import Link from "next/link";
import { AdminDenied, AdminPage, PageLinks, SearchForm } from "@/components/admin-page";
import { loadAdminCategories } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const result = await loadAdminCategories(query, params.page);
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <AdminPage title="Issue categories" lede="Codes stay fixed so existing reports keep their category.">
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <p className="text-small">
            <Link href="/admin/categories/new">New category</Link>
          </p>
          <SearchForm action="/admin/categories" query={query} />
          {result.total === 0 ? <p>No categories match this search.</p> : null}
          {result.total > 0 ? (
            <ol className="flex flex-col gap-3">
              {result.items.map((category) => (
                <li key={category.id} className="border border-border px-3 py-3">
                  <h2 className="text-subsection font-semibold">
                    <Link href={`/admin/categories/${category.id}`}>{category.name}</Link>
                  </h2>
                  <p className="mt-2 text-small text-muted-foreground">
                    {category.code}
                    {" · "}
                    {category.isActive ? "Active" : "Inactive"}
                    {" · "}
                    order {category.sortOrder}
                    {" · "}
                    {category.issueCount} reports
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/categories" query={query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
