import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthPage } from "@/components/auth-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestVerificationAction, verifyEmailAction } from "@/lib/auth/actions";
import { isEmailConfigured } from "@/lib/auth/email";
import { EMAIL_NOT_CONFIGURED } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const emailReady = isEmailConfigured();

  return (
    <AuthPage
      title="Confirm email"
      lede="Enter the verification token from your email, or ask for a new message."
    >
      {emailReady ? (
        <>
          <AuthForm action={verifyEmailAction} submitLabel="Confirm email">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token">Verification token</Label>
              <Input
                id="token"
                name="token"
                defaultValue={params.token ?? ""}
                autoComplete="one-time-code"
                required
              />
            </div>
          </AuthForm>
          <AuthForm action={requestVerificationAction} submitLabel="Send a new message">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
          </AuthForm>
        </>
      ) : (
        <p role="status">{EMAIL_NOT_CONFIGURED}</p>
      )}
      <p className="text-small">
        <Link href="/login">Back to log in</Link>
      </p>
    </AuthPage>
  );
}
