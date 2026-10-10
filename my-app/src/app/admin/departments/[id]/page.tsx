import Link from "next/link";
import {
  ActiveToggleForm,
  DepartmentEditForm,
  MembershipAddForm,
  MembershipEndForm,
} from "@/components/admin-forms";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { formatWhen } from "@/lib/issues/labels";
import { loadAdminDepartment } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function DepartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const saved = (await searchParams).saved;
  const result = await loadAdminDepartment(id);

  return (
    <AdminPage title={result.ok ? result.department.name : "Department"}>
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          {saved ? <p role="status">Saved.</p> : null}
          <p className="text-small">
            <Link href="/admin/departments">All departments</Link>
          </p>
          <dl className="border border-border text-small">
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Code</dt>
              <dd>{result.department.code}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Status</dt>
              <dd>{result.department.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Open assignments</dt>
              <dd>{result.department.activeAssignments}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="font-semibold">Created</dt>
              <dd>
                <time dateTime={result.department.createdAt.toISOString()}>
                  {formatWhen(result.department.createdAt)} UTC
                </time>
              </dd>
            </div>
          </dl>
          <section className="flex flex-col gap-3">
            <h2 className="text-subsection font-semibold">Details</h2>
            <DepartmentEditForm
              id={result.department.id}
              name={result.department.name}
              description={result.department.description}
            />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-subsection font-semibold">Availability</h2>
            <p className="text-small text-muted-foreground">
              Deactivation is refused while this department has open memberships or active assignments. Existing reports stay in the record.
            </p>
            <ActiveToggleForm id={result.department.id} isActive={result.department.isActive} kind="department" />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-subsection font-semibold">Staff</h2>
            {result.department.memberships.length === 0 ? <p>No current staff memberships.</p> : null}
            {result.department.memberships.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {result.department.memberships.map((membership) => (
                  <li key={membership.id} className="rounded-md border border-border bg-card px-4 py-4">
                    <p className="font-semibold">{membership.name}</p>
                    <p className="text-small text-muted-foreground">
                      {membership.email}
                      {" · "}
                      since {formatWhen(membership.startedAt)} UTC
                    </p>
                    <div className="mt-3">
                      <MembershipEndForm departmentId={result.department.id} membershipId={membership.id} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <MembershipAddForm departmentId={result.department.id} staff={result.staff} />
          </section>
        </>
      ) : null}
    </AdminPage>
  );
}
