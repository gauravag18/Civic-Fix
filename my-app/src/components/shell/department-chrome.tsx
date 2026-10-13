"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PasswordLink, UserMenu, type CitizenProfile } from "@/components/shell/citizen-chrome";
import { Wordmark } from "@/components/shell/wordmark";
import { cn } from "cn";

const CRUMB_LABELS: Record<string, string> = {
  "/department": "Queue",
  "/department/issues": "Report",
  "/account/password": "Change password",
};

export function DepartmentChrome({
  profile,
  showAdmin,
  title,
  lede,
  children,
}: {
  profile: CitizenProfile | null;
  showAdmin: boolean;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-6">
          <Wordmark icon={false} />
          <DepartmentNav profile={profile} showAdmin={showAdmin} />
        </div>
      </header>
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

export function DepartmentNav({
  profile,
  showAdmin,
}: {
  profile: CitizenProfile | null;
  showAdmin: boolean;
}) {
  const pathname = usePathname();
  const [view, setView] = useState<string | null>(null);
  useEffect(() => {
    setView(new URLSearchParams(window.location.search).get("view"));
  }, [pathname]);
  const taking = pathname === "/department" && view === "unassigned";
  const queue =
    (pathname === "/department" && !taking) || pathname.startsWith("/department/issues");

  return (
    <nav aria-label="Department" className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
      <NavItem href="/department" current={queue}>
        Queue
      </NavItem>
      <NavItem href="/department?view=unassigned" current={taking}>
        Reports to take
      </NavItem>
      {showAdmin ? (
        <NavItem href="/admin" current={false}>
          Administration
        </NavItem>
      ) : null}
      {profile ? (
        <div className="ml-1 flex items-center gap-2 border-l border-border pl-2">
          <PasswordLink />
          <UserMenu profile={profile} />
        </div>
      ) : (
        <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
          Sign in
        </Link>
      )}
    </nav>
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

function breadcrumb(pathname: string): { href: string; label: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  return parts.flatMap((part, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    if (href === "/account") return [];
    return [{ href, label: CRUMB_LABELS[href] ?? "Details" }];
  });
}
