import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const authorization = await getAuthorization();

  return (
    <AuthPage
      title="Change password"
      lede="Use the current password. A provisioned staff account must replace the initial password before opening the department queue."
    >
      {authorization ? (
        <ChangePasswordForm />
      ) : (
        <p>
          You are not logged in. <Link href="/login">Log in</Link>
        </p>
      )}
    </AuthPage>
  );
}
