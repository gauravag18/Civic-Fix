import type { ReactNode } from "react";
import { PublicFrame } from "@/components/shell/public-frame";

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
    <PublicFrame>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted-foreground">{lede}</p>
        </header>
        <div className="rounded-md border border-border bg-card p-4 sm:p-6">{children}</div>
      </main>
    </PublicFrame>
  );
}
