import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthPage } from "@/components/auth-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <AuthPage
      title="Create an account"
      lede="Registration creates a citizen account. It does not grant staff or administrator access."
    >
      <AuthForm action={registerAction} submitLabel="Create account">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-small text-muted-foreground">
            Use 12 to 128 characters. Do not reuse your name or email.
          </p>
        </div>
      </AuthForm>
      <p className="text-small">
        <Link href="/login">Already have an account</Link>
      </p>
    </AuthPage>
  );
}
