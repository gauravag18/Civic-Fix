import { AdminDenied, AdminPage, DirectoryBar, EmptyNote, PageLinks, RecordCard, RecordGrid } from "@/components/admin-page";
import { loadAdminUsers } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

function activationLabel(activation: "admin" | "registered"): string {
  if (activation === "admin") return "Admin-provisioned";
  return "Registered";
}

function statusText(status: string): string {
  if (status === "ACTIVE") return "Active";
  if (status === "SUSPENDED") return "Suspended";
  if (status === "DISABLED") return "Disabled";
  return status;
}

function roleText(role: string): string {
  if (role === "CITIZEN") return "Citizen";
  if (role === "DEPARTMENT_STAFF") return "Department staff";
  if (role === "MODERATOR") return "Moderator";
  if (role === "ADMINISTRATOR") return "Administrator";
  return role;
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
          <DirectoryBar action="/admin/users" query={query} createHref="/admin/users/new" createLabel="New user" />
          {result.total === 0 ? (
            <EmptyNote>{query ? "No users match this search." : "No users yet."}</EmptyNote>
          ) : (
            <RecordGrid>
              {result.items.map((user) => (
                <RecordCard
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  title={user.name}
                  facts={[
                    { label: "Email", value: user.email },
                    { label: "Status", value: statusText(user.accountStatus) },
                    { label: "Account", value: activationLabel(user.activation) },
                    { label: "Roles", value: user.roles.map(roleText).join(", ") || "None" },
                    { label: "Department", value: user.departmentName ?? "None" },
                  ]}
                />
              ))}
            </RecordGrid>
          )}
          {result.total > result.pageSize ? (
            <PageLinks base="/admin/users" query={query} page={result.page} lastPage={lastPage} />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
