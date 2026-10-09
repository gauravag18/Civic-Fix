"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  // Sign-out deletes this browser's session cookie. A copied JWT for an account
  // that is still active remains valid until the 12-hour expiry. Disablement,
  // suspension, a lost email verification, or a password change is enforced on
  // the next session check, which clears that cookie. Auth.js is not using the
  // custom Session table for these JWTs.
  return (
    <Button type="button" variant="secondary" onClick={() => signOut({ callbackUrl: "/" })}>
      Log out
    </Button>
  );
}
