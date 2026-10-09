import type { ReactNode } from "react";
import Link from "next/link";

export function AuthPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-4">
        <p className="text-small">
          <Link href="/">CivicFix</Link>
        </p>
        <h1 className="mt-2 text-page-title font-semibold">{title}</h1>
        <p className="mt-2 text-body">{lede}</p>
      </header>
      {children}
    </main>
  );
}
