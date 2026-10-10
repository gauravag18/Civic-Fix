import type { ReactNode } from "react";
import Link from "next/link";
import { NotificationLink } from "@/components/notification-link";

export function AppPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-4">
        <nav aria-label="Account" className="text-small">
          <Link href="/">CivicFix</Link>
          {" · "}
          <Link href="/report">Report</Link>
          {" · "}
          <Link href="/my-issues">My reports</Link>
          {" · "}
          <Link href="/department">Department</Link>
          {" · "}
          <Link href="/account">Account</Link>
          <NotificationLink />
        </nav>
        <h1 className="mt-2 text-page-title font-semibold">{title}</h1>
        {lede ? <p className="mt-2 max-w-prose text-body">{lede}</p> : null}
      </header>
      {children}
    </main>
  );
}
