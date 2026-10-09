import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthPage } from "@/components/auth-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/lib/auth/actions";
import { isEmailConfigured } from "@/lib/auth/email";
import { EMAIL_NOT_CONFIGURED } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const emailReady = isEmailConfigured();

  return (
    <AuthPage
      title="Reset password"
      lede="Choose a new password. Existing login sessions stop working after the change."
    >
      {emailReady ? (
        <AuthForm action={resetPasswordAction} submitLabel="Update password">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token">Reset token</Label>
            <Input
              id="token"
              name="token"
              defaultValue={params.token ?? ""}
              autoComplete="one-time-code"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
        </AuthForm>
      ) : (
        <p role="status">{EMAIL_NOT_CONFIGURED}</p>
      )}
      <p className="text-small">
        <Link href="/login">Back to log in</Link>
      </p>
    </AuthPage>
  );
}
