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
