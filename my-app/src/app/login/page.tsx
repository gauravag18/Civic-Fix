import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { LoginForm } from "@/components/login-form";
import { isGoogleConfigured } from "@/lib/auth/google";
import { SIGN_IN_FAILURE } from "@/lib/auth/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialMessage = params.error ? SIGN_IN_FAILURE : undefined;

  return (
    <AuthPage
      title="Log in"
      lede="Use the email and password for your CivicFix account."
    >
      <LoginForm initialMessage={initialMessage} googleEnabled={isGoogleConfigured()} />
      <p className="text-small">
        <Link href="/register">Create an account</Link>
        {" · "}
        <Link href="/forgot-password">Forgot password</Link>
      </p>
    </AuthPage>
  );
}
