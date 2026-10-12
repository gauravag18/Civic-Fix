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
      {state.error && state.message ? (
        <p role="alert" className="text-destructive">
          {state.message}
        </p>
      ) : null}
      {children}
      {!state.error && state.message ? (
        <p role="status">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait" : submitLabel}
      </Button>
    </form>
  );
}
