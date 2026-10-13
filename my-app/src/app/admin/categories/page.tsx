import { AdminDenied, AdminPage, DirectoryBar, EmptyNote, PageLinks, RecordCard, RecordGrid } from "@/components/admin-page";
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
          <DirectoryBar
            action="/admin/categories"
            query={query}
            createHref="/admin/categories/new"
            createLabel="New category"
          />
          {result.total === 0 ? (
            <EmptyNote>{query ? "No categories match this search." : "No categories yet."}</EmptyNote>
          ) : (
            <RecordGrid>
              {result.items.map((category) => (
                <RecordCard
                  key={category.id}
                  href={`/admin/categories/${category.id}`}
                  title={category.name}
                  code={category.code}
                  facts={[
                    { label: "Status", value: category.isActive ? "Active" : "Inactive" },
                    { label: "Order", value: category.sortOrder },
                    { label: "Reports", value: category.issueCount },
                  ]}
                />
              ))}
            </RecordGrid>
          )}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/categories" query={query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
