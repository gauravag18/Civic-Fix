import Link from "next/link";
import { Wordmark } from "@/components/shell/wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-3 text-sm text-muted-foreground">
            CivicFix keeps a report, its photographs, and its status with the person who submitted it and the department assigned to it.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <Link href="/#how-it-works" className="text-foreground no-underline hover:underline">
            How it works
          </Link>
          <Link href="/report" className="text-foreground no-underline hover:underline">
            Report an issue
          </Link>
          <Link href="/login" className="text-foreground no-underline hover:underline">
            Sign in
          </Link>
          <Link href="/register" className="text-foreground no-underline hover:underline">
            Create an account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
