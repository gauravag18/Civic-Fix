import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { LoginForm } from "@/components/login-form";
import { isEmailConfigured } from "@/lib/auth/email";
import { isGoogleConfigured } from "@/lib/auth/google";
import { LOGIN_EMAIL_UNAVAILABLE, SIGN_IN_FAILURE } from "@/lib/auth/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialMessage = params.error ? SIGN_IN_FAILURE : undefined;
  const emailReady = isEmailConfigured();
  const googleEnabled = isGoogleConfigured();

  return (
    <AuthPage
      title="Log in"
      lede="Email and password sign-in is available for an existing verified account. Unverified, disabled, and suspended accounts cannot sign in."
    >
      {emailReady ? null : <p role="status">{LOGIN_EMAIL_UNAVAILABLE}</p>}
      <LoginForm initialMessage={initialMessage} googleEnabled={googleEnabled} />
      <p className="text-small">
        <Link href="/register">Create an account</Link>
        {" · "}
        <Link href="/forgot-password">Forgot password</Link>
      </p>
    </AuthPage>
  );
}
