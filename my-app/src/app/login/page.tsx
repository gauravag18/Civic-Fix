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
  const googleEnabled = isGoogleConfigured();

  return (
    <AuthPage
      title="Log in"
      lede="Sign in with your email and password. Disabled and suspended accounts cannot sign in."
    >
      <LoginForm initialMessage={initialMessage} googleEnabled={googleEnabled} />
      <p className="text-small">
        <Link href="/register">Create an account</Link>
      </p>
    </AuthPage>
  );
}
