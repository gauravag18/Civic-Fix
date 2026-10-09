"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { PublicResult } from "@/lib/auth/service";

const initial: PublicResult = { error: false, message: "" };

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (previous: PublicResult, formData: FormData) => Promise<PublicResult>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <p role="alert" className={state.error ? "text-destructive" : "text-foreground"}>
          {state.message}
        </p>
      ) : null}
      {children}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait" : submitLabel}
      </Button>
    </form>
  );
}
