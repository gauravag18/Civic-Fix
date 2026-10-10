import Link from "next/link";
import { AdminDenied, AdminPage, PageLinks, SearchForm } from "@/components/admin-page";
import { loadAdminUsers } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

function activationLabel(activation: "email" | "admin" | "pending"): string {
  if (activation === "admin") return "Admin-provisioned";
  if (activation === "email") return "Email confirmed";
  return "Email not confirmed";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const result = await loadAdminUsers(query, params.page);
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <AdminPage title="Users" lede="Search registered accounts. There is no public administrator registration.">
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <p className="text-small">
            <Link href="/admin/users/new">Provision staff</Link>
          </p>
          <SearchForm action="/admin/users" query={query} />
          {result.total === 0 ? <p>No users match this search.</p> : null}
          {result.total > 0 ? (
            <ol className="flex flex-col gap-3">
              {result.items.map((user) => (
                <li key={user.id} className="border border-border px-3 py-3">
                  <h2 className="text-subsection font-semibold">
                    <Link href={`/admin/users/${user.id}`}>{user.name}</Link>
                  </h2>
                  <p className="mt-2 text-small text-muted-foreground">
                    {user.email}
                    {" · "}
                    {user.accountStatus}
                    {" · "}
                    {activationLabel(user.activation)}
                    {" · "}
                    {user.roles.join(", ") || "No roles"}
                    {user.departmentName ? ` · ${user.departmentName}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/users" query={query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
