"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { MenuButton } from "@/components/shell/menu-button";
import { Wordmark } from "@/components/shell/wordmark";
import { cn } from "cn";

export type ShellLink = {
  href: string;
  label: string;
};

function activeHref(pathname: string, search: string, href: string): boolean {
  const [path, query] = href.split("?");
  const current = new URLSearchParams(search);
  if (query) {
    if (pathname !== path) return false;
    const expected = new URLSearchParams(query);
    for (const [key, value] of expected) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }
  if (path === "/department") {
    return pathname.startsWith("/department") && current.get("view") !== "unassigned";
  }
  if (path === "/admin") return pathname === "/admin";
  if (path === "/my-issues") return pathname === "/my-issues" || pathname.startsWith("/issues/");
  if (path === "/account") return pathname === "/account" || pathname.startsWith("/account/");
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLinks({ items, pathname, search }: { items: ShellLink[]; pathname: string; search: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const current = activeHref(pathname, search, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-semibold no-underline",
                current ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveLinks({ items }: { items: ShellLink[] }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return <NavLinks items={items} pathname={pathname} search={search} />;
}

function WorkspaceLinks({ items }: { items: ShellLink[] }) {
  return (
    <Suspense fallback={<NavLinks items={items} pathname="" search="" />}>
      <ActiveLinks items={items} />
    </Suspense>
  );
}

function ChromeBody({
  items,
  signedIn,
  title,
  lede,
  bell,
  children,
}: {
  items: ShellLink[];
  signedIn: boolean;
  title: string;
  lede?: string;
  bell: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);

  return (
    <div className="flex min-h-full w-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="px-4 py-5">
          <Wordmark />
        </div>
        <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3">
          <WorkspaceLinks items={items} />
        </nav>
        <div className="p-4">
          {signedIn ? (
            <SignOutButton variant="ghost" className="w-full justify-start" />
          ) : (
            <Link href="/login" className="block rounded-md px-3 py-2 text-sm font-semibold text-foreground no-underline hover:bg-muted">
              Sign in
            </Link>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <MenuButton label="Workspace">
              <WorkspaceLinks items={items} />
              {signedIn ? <SignOutButton variant="ghost" className="mt-3 justify-start" /> : null}
            </MenuButton>
            <div className="lg:hidden">
              <Wordmark />
            </div>
          </div>
          {bell}
        </header>
        <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {crumbs.length > 1 ? (
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap gap-2">
                {crumbs.map((crumb, index) => (
                  <li key={crumb.href} className="flex items-center gap-2">
                    {index > 0 ? <span aria-hidden="true">/</span> : null}
                    {index === crumbs.length - 1 ? (
                      <span className="text-foreground">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="text-link no-underline hover:underline">
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <header>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {lede ? <p className="mt-2 max-w-2xl text-muted-foreground">{lede}</p> : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

const CRUMB_LABELS: Record<string, string> = {
  "/report": "Report an issue",
  "/my-issues": "My issues",
  "/issues": "Report",
  "/notifications": "Notifications",
  "/account": "Account",
  "/account/password": "Change password",
  "/department": "Department queue",
  "/department/issues": "Report",
  "/admin": "Overview",
  "/admin/departments": "Departments",
  "/admin/departments/new": "New department",
  "/admin/categories": "Categories",
  "/admin/categories/new": "New category",
  "/admin/users": "Users and staff",
  "/admin/users/new": "Provision staff",
};

function breadcrumb(pathname: string): { href: string; label: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  return parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    return { href, label: CRUMB_LABELS[href] ?? "Details" };
  });
}

export function AppChrome(props: {
  items: ShellLink[];
  signedIn: boolean;
  title: string;
  lede?: string;
  bell: ReactNode;
  children: ReactNode;
}) {
  return <ChromeBody {...props} />;
}
