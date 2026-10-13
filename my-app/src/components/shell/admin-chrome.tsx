"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PasswordLink, UserMenu, type CitizenProfile } from "@/components/shell/citizen-chrome";
import { Wordmark } from "@/components/shell/wordmark";
import { cn } from "cn";

const CRUMB_LABELS: Record<string, string> = {
  "/admin": "Overview",
  "/admin/departments": "Departments",
  "/admin/departments/new": "New department",
  "/admin/categories": "Categories",
  "/admin/categories/new": "New category",
  "/admin/users": "Users and staff",
  "/admin/users/new": "Provision staff",
  "/admin/issues": "Reports",
  "/account/password": "Change password",
};

export function AdminChrome({
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
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-6">
          <Wordmark icon={false} />
          <AdminNav profile={profile} />
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

export function AdminNav({ profile }: { profile: CitizenProfile | null }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
      <NavItem href="/admin" current={pathname === "/admin"}>
        Overview
      </NavItem>
      <NavItem href="/admin/departments" current={pathname.startsWith("/admin/departments")}>
        Departments
      </NavItem>
      <NavItem href="/admin/categories" current={pathname.startsWith("/admin/categories")}>
        Categories
      </NavItem>
      <NavItem href="/admin/users" current={pathname.startsWith("/admin/users")}>
        Users and staff
      </NavItem>
      <NavItem href="/admin/issues" current={pathname.startsWith("/admin/issues")}>
        Reports
      </NavItem>
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
