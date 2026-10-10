import type { ReactNode } from "react";
import Link from "next/link";
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
    <form action={action} method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="q" className="text-label font-semibold">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          maxLength={80}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
