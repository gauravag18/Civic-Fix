import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthPage } from "@/components/auth-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestResetAction } from "@/lib/auth/actions";
import { isEmailConfigured } from "@/lib/auth/email";
import { EMAIL_NOT_CONFIGURED } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const emailReady = isEmailConfigured();

  return (
    <AuthPage
      title="Forgot password"
      lede="We will send reset instructions when email delivery is available."
    >
      {emailReady ? (
        <AuthForm action={requestResetAction} submitLabel="Send reset message">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
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
