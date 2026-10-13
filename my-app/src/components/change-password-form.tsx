"use client";

import { useActionState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/auth/actions";
import type { PublicResult } from "@/lib/auth/service";

const initial: PublicResult = { error: false, message: "" };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {state.message ? (
        <p role={state.error ? "alert" : "status"} className={state.error ? "text-destructive" : undefined}>
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input id="current-password" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="next-password">New password</Label>
        <Input
          id="next-password"
          name="nextPassword"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-next-password">Confirm new password</Label>
        <Input
          id="confirm-next-password"
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Update password"}
      </Button>
      {!state.error && state.message ? (
        <Button type="button" variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign in with the new password
        </Button>
      ) : null}
    </form>
  );
}
