import Link from "next/link";
import { AccountStatusForm, GrantRoleForm, RevokeRoleForm } from "@/components/admin-forms";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { ADMIN_STAFF_READY } from "@/lib/admin/messages";
import { loadAdminUser } from "@/lib/admin/queries";
import { ROLE_CODES, type RoleCode } from "@/lib/auth/roles";
import { formatWhen } from "@/lib/issues/labels";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; provisioned?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const result = await loadAdminUser(id);

  return (
    <AdminPage title={result.ok ? result.user.name : "User"}>
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <UserRecord
          saved={query.saved}
          provisioned={query.provisioned}
          user={result.user}
          viewerId={result.viewerId}
        />
      ) : null}
    </AdminPage>
  );
}

function UserRecord({
  saved,
  provisioned,
  user,
  viewerId,
}: {
  saved: string | undefined;
  provisioned: string | undefined;
  user: {
    id: string;
    name: string;
    email: string;
    accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED";
    roles: RoleCode[];
    departmentName: string | null;
    departmentId: string | null;
    emailVerifiedAt: Date | null;
    disabledAt: Date | null;
    activation: "email" | "admin" | "pending";
  };
  viewerId: string;
}) {
  const self = user.id === viewerId;
  const missing = ROLE_CODES.filter((role) => !user.roles.includes(role));
  return (
    <>
      {saved ? <p role="status">Saved.</p> : null}
      {provisioned ? <p role="status">{ADMIN_STAFF_READY}</p> : null}
      <p className="text-small">
        <Link href="/admin/users">All users</Link>
      </p>
      <dl className="border border-border text-small">
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
          <dt className="font-semibold">Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
          <dt className="font-semibold">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
          <dt className="font-semibold">Status</dt>
          <dd>{user.accountStatus}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
          <dt className="font-semibold">Email verified</dt>
          <dd>
            {user.emailVerifiedAt ? (
              <time dateTime={user.emailVerifiedAt.toISOString()}>{formatWhen(user.emailVerifiedAt)} UTC</time>
            ) : (
              "Not verified"
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
          <dt className="font-semibold">Activation</dt>
          <dd>
            {user.activation === "admin"
              ? "Admin-provisioned"
              : user.activation === "email"
                ? "Email confirmation"
                : "Waiting for email confirmation"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 px-3 py-2">
          <dt className="font-semibold">Department</dt>
          <dd>
            {user.departmentId ? (
              <Link href={`/admin/departments/${user.departmentId}`}>{user.departmentName}</Link>
            ) : (
              "None"
            )}
          </dd>
        </div>
      </dl>
      {self ? (
        <p role="status">You cannot change your own roles or account status.</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-subsection font-semibold">Account status</h2>
            <AccountStatusForm userId={user.id} status={user.accountStatus} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-subsection font-semibold">Roles</h2>
            {user.roles.length === 0 ? <p>No active roles.</p> : null}
            <ul className="flex flex-col gap-3">
              {user.roles.map((role) => (
                <li key={role} className="flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-3">
                  <span>{role}</span>
                  <RevokeRoleForm userId={user.id} role={role} />
                </li>
              ))}
            </ul>
            <GrantRoleForm userId={user.id} roles={missing} />
            <p className="text-small text-muted-foreground">
              Grant department staff here, then add a membership from the department page. The last active administrator cannot be removed or locked out.
            </p>
          </section>
        </>
      )}
    </>
  );
}
