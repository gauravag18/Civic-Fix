import Link from "next/link";
import { StaffProvisionForm } from "@/components/admin-forms";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { loadStaffProvision } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function ProvisionStaffPage() {
  const result = await loadStaffProvision();

  return (
    <AdminPage
      title="Provision staff"
      lede="Create a department staff account without public registration or email delivery. The initial password must be passed on through a separate secure channel."
    >
      {!result.ok ? <AdminDenied reason={result.reason} /> : null}
      {result.ok ? (
        <>
          <p className="text-small">
            <Link href="/admin/users">All users</Link>
          </p>
          <StaffProvisionForm departments={result.departments} />
        </>
      ) : null}
    </AdminPage>
  );
}
