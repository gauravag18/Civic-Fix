"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export type CitizenProfile = {
  name: string;
  email: string;
  role: string;
};

const CRUMB_LABELS: Record<string, string> = {
  "/report": "Report an issue",
  "/my-issues": "My issues",
  "/issues": "Report",
  "/account": "Account",
  "/account/password": "Change password",
};

export function CitizenChrome({
  profile,
  title,
  lede,
  children,
}: {
  profile: CitizenProfile | null;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <CitizenNav profile={profile} />
      <main id="content" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {crumbs.length > 1 ? (
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <ol className="flex flex-wrap gap-2">
              {crumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {index === crumbs.length - 1 ? (
                    <span className="text-foreground">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="text-link">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {lede ? <p className="mt-2 max-w-2xl text-muted-foreground">{lede}</p> : null}
        </header>
        {children}
      </main>
    </div>
  );
}

export function CitizenNavLinks({ profile }: { profile: CitizenProfile | null }) {
  const pathname = usePathname();
  const reportCurrent = pathname === "/report";
  const issuesCurrent = pathname === "/my-issues" || pathname.startsWith("/issues/");

  return (
    <nav aria-label="Citizen" className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
      <NavItem href="/report" current={reportCurrent}>
        Report an issue
      </NavItem>
      <NavItem href="/my-issues" current={issuesCurrent}>
        My issues
      </NavItem>
      {profile ? <AccountActions profile={profile} /> : (
        <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
          Sign in
        </Link>
      )}
    </nav>
  );
}

function CitizenNav({ profile }: { profile: CitizenProfile | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-6">
        <Wordmark icon={false} />
        <CitizenNavLinks profile={profile} />
      </div>
    </header>
  );
}

function NavItem({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm font-semibold sm:px-3 sm:py-2",
        current ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function AccountActions({ profile }: { profile: CitizenProfile }) {
  return (
    <div className="ml-1 flex items-center gap-2 border-l border-border pl-2">
      <PasswordLink />
      <UserMenu profile={profile} />
    </div>
  );
}

export function PasswordLink() {
  const pathname = usePathname();
  const current = pathname === "/account/password";

  return (
    <Button variant="outline" asChild className={cn(current && "border-accent bg-accent/10 text-accent")}>
      <Link href="/account/password" aria-current={current ? "page" : undefined}>
        <KeyIcon />
        Password
      </Link>
    </Button>
  );
}

export function UserMenu({ profile }: { profile: CitizenProfile }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${profile.name}, ${profile.role}`}
        onClick={() => setOpen((value) => !value)}
      >
        <UserIcon />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="absolute right-0 z-40 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-4 shadow-[var(--elevation-raised)]"
        >
          <p id={titleId} className="font-semibold">{profile.name}</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">{profile.email}</p>
          <p className="mt-2 text-sm font-semibold text-accent">{profile.role}</p>
          <SignOutButton variant="outline" className="mt-4 w-full" />
        </div>
      ) : null}
    </div>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <circle cx="8" cy="14" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 12.2 19.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 8 18.2 10.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19.2c1.4-3 3.6-4.4 6.5-4.4s5.1 1.4 6.5 4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function breadcrumb(pathname: string): { href: string; label: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  return parts.flatMap((part, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    if (href === "/account") return [];
    return [{ href, label: CRUMB_LABELS[href] ?? "Details" }];
  });
}
