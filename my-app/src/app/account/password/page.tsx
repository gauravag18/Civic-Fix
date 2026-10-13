import Link from "next/link";
import { AppPage } from "@/components/app-page";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getAuthorization } from "@/lib/auth/authorization";
import { workspaceOf } from "@/lib/auth/home-path";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const authorization = await getAuthorization();

  const workspace = workspaceOf(authorization);
  const area = workspace === "department" || workspace === "admin" ? workspace : "citizen";

  return (
    <AppPage
      area={area}
      title="Change password"
      lede="Use the current password. Changing it is optional. A forgotten password cannot be reset by email."
    >
      {authorization ? (
        <ChangePasswordForm />
      ) : (
        <p>
          You are not logged in. <Link href="/login">Log in</Link>
        </p>
      )}
    </AppPage>
  );
}
