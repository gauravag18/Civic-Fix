import { DepartmentCreateForm } from "@/components/admin-forms";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { requireAdmin } from "@/lib/admin/service";
import { getAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function NewDepartmentPage() {
  const authorization = await getAuthorization();
  const access = authorization
    ? { userId: authorization.userId, capabilities: authorization.capabilities }
    : null;
  const admin = requireAdmin(access);

  return (
    <AdminPage title="New department" lede="The code stays fixed after the department is created.">
      {!admin.ok ? <AdminDenied reason={admin.reason} /> : <DepartmentCreateForm />}
    </AdminPage>
  );
}
