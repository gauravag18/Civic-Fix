import { CategoryCreateForm } from "@/components/admin-forms";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { requireAdmin } from "@/lib/admin/service";
import { getAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  const authorization = await getAuthorization();
  const access = authorization
    ? { userId: authorization.userId, capabilities: authorization.capabilities }
    : null;
  const admin = requireAdmin(access);

  return (
    <AdminPage title="New category" lede="Use a new code. Do not recreate a category that already exists.">
      {!admin.ok ? <AdminDenied reason={admin.reason} /> : <CategoryCreateForm />}
    </AdminPage>
  );
}
