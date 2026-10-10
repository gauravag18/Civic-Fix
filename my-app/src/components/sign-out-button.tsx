"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function SignOutButton({
  className,
  variant = "secondary",
}: {
  className?: string;
  variant?: "secondary" | "ghost" | "outline";
}) {
  // Sign-out deletes this browser's session cookie. A copied JWT for an account
  // that is still active remains valid until the 12-hour expiry. Disablement,
  // suspension, or a password change is enforced on
  // the next session check, which clears that cookie. Auth.js is not using the
  // custom Session table for these JWTs.
  return (
    <Button
      type="button"
      variant={variant}
      className={cn(className)}
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Sign out
    </Button>
  );
}
