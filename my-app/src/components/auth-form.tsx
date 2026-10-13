"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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
  const [dismissed, setDismissed] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const created = !state.error && state.message.length > 0 && !dismissed;

  useEffect(() => {
    setDismissed(false);
  }, [state.message]);

  useEffect(() => {
    if (!created) return;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDismissed(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [created]);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error && state.message ? (
          <p role="alert" className="text-destructive">
            {state.message}
          </p>
        ) : null}
        {children}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Please wait" : submitLabel}
        </Button>
      </form>
      {created ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(52_37_29/0.4)]"
            aria-label="Close"
            onClick={() => setDismissed(true)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative w-full max-w-sm rounded-md border border-border bg-card p-6 shadow-[var(--elevation-raised)] outline-none"
          >
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              Account created
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your citizen account is ready. Sign in with the email and password you just chose.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild>
                <Link href="/login" className="no-underline">
                  Sign in
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
