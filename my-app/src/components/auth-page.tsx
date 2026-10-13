import type { ReactNode } from "react";
import { AuthIllustration } from "@/components/auth-illustration";
import { SiteFooter } from "@/components/shell/site-footer";

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
    <div className="flex min-h-full flex-1 flex-col">
      <main id="content" className="grid w-full flex-1 lg:grid-cols-2">
        <aside className="flex flex-col justify-center gap-8 border-b border-border bg-card px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r">
          <div className="max-w-sm">
            <h2 className="text-2xl font-semibold tracking-tight">A civic report stays on the record.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Citizens report a street, lighting, drainage, or sanitation problem. The department that takes the work updates the status, and you can read that record from your account.
            </p>
          </div>
          <AuthIllustration />
        </aside>
        <section className="flex items-center justify-center px-4 py-10 sm:px-10">
          <div className="flex w-full max-w-md flex-col gap-6">
            <header>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-muted-foreground">{lede}</p>
            </header>
            <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 sm:p-6">{children}</div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
