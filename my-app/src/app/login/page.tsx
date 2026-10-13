import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
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
      lede="Sign in with your email and password. Disabled and suspended accounts cannot sign in."
    >
      <LoginForm initialMessage={initialMessage} />
      <Button variant="outline" asChild className="w-full">
        <Link href="/register" className="no-underline">
          Create a citizen account
        </Link>
      </Button>
    </AuthPage>
  );
}
