import Link from "next/link";
import { getAuthorization } from "@/lib/auth/authorization";
import { workspaceOf } from "@/lib/auth/home-path";

export async function SiteFooter() {
  const workspace = workspaceOf(await getAuthorization());

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <p className="max-w-sm text-sm text-muted-foreground">
          A report, its photographs, and its status stay with the person who submitted it and the department assigned to it.
        </p>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          {workspace === "department" ? (
            <Link href="/department" className="text-foreground">
              Department queue
            </Link>
          ) : null}
          {workspace === "admin" ? (
            <Link href="/admin" className="text-foreground">
              Administration
            </Link>
          ) : null}
          {workspace === "citizen" ? (
            <Link href="/my-issues" className="text-foreground">
              My issues
            </Link>
          ) : null}
          {workspace ? null : (
            <>
              <Link href="/login" className="text-foreground">
                Sign in
              </Link>
              <Link href="/register" className="text-foreground">
                Create a citizen account
              </Link>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
