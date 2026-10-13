import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "cn";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  ADMIN_FORBIDDEN,
  ADMIN_MISSING,
  ADMIN_SIGN_IN,
  ADMIN_UNAVAILABLE,
} from "@/lib/admin/messages";

export function AdminPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <WorkspaceShell area="admin" title={title} lede={lede}>
      {children}
    </WorkspaceShell>
  );
}

export function AdminDenied({
  reason,
}: {
  reason: "signed-out" | "forbidden" | "unavailable" | "missing";
}) {
  if (reason === "signed-out") {
    return (
      <p>
        {ADMIN_SIGN_IN} <Link href="/login">Log in</Link>
      </p>
    );
  }
  if (reason === "forbidden") return <p role="status">{ADMIN_FORBIDDEN}</p>;
  if (reason === "missing") return <p role="status">{ADMIN_MISSING}</p>;
  return <p role="alert">{ADMIN_UNAVAILABLE}</p>;
}

export function PageLinks({
  base,
  query,
  page,
  lastPage,
}: {
  base: string;
  query: string;
  page: number;
  lastPage: number;
}) {
  const href = (nextPage: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (nextPage > 1) search.set("page", String(nextPage));
    const value = search.toString();
    return value ? `${base}?${value}` : base;
  };
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-4 text-small">
      <p>
        Page {page} of {lastPage}
      </p>
      {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : null}
      {page < lastPage ? <Link href={href(page + 1)}>Next</Link> : null}
    </nav>
  );
}

export function SearchForm({ action, query }: { action: string; query: string }) {
  return (
    <form action={action} method="get" className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="q" className="text-label font-semibold">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          maxLength={80}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button type="submit" variant="outline" className="w-full sm:w-auto">
        Search
      </Button>
    </form>
  );
}

export function DirectoryBar({
  action,
  query,
  createHref,
  createLabel,
  children,
}: {
  action: string;
  query: string;
  createHref?: string;
  createLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchForm action={action} query={query} />
        {createHref && createLabel ? (
          <Button asChild className="w-full shrink-0 lg:w-auto">
            <Link href={createHref}>{createLabel}</Link>
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function RecordGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>;
}

export function RecordCard({
  href,
  title,
  code,
  marks,
  facts,
}: {
  href: string;
  title: string;
  code?: string;
  marks?: ReactNode;
  facts: { label: string; value: ReactNode }[];
}) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className="flex h-full flex-col rounded-md border border-border bg-card p-5 no-underline transition-colors hover:border-accent"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {code ? (
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold tracking-wide text-foreground">
              {code}
            </span>
          ) : null}
        </div>
        {marks ? <div className="mt-3 flex flex-wrap items-center gap-2">{marks}</div> : null}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs font-semibold text-muted-foreground">{fact.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Link>
    </li>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className={cn("rounded-md border border-dashed border-border bg-card px-5 py-10 text-center text-muted-foreground")}>
      {children}
    </p>
  );
}
