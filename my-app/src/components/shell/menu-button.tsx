"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export function MenuButton({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground lg:hidden"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(52_37_29/0.35)]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id={titleId}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col gap-4 overflow-y-auto bg-card p-4 shadow-raised"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{label}</p>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              className="flex flex-col gap-1"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) {
                  window.setTimeout(() => setOpen(false), 0);
                }
              }}
            >
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
