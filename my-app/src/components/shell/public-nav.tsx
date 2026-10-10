import Link from "next/link";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { SignOutButton } from "@/components/sign-out-button";
import { MenuButton } from "@/components/shell/menu-button";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

const linkClass =
  "rounded-md px-3 py-2 text-sm font-semibold text-foreground no-underline hover:bg-muted";

export async function PublicNav() {
  const authorization = await getAuthorization();
  const staff = authorization
    ? hasCapability(authorization.capabilities, Capability.departmentWork)
    : false;
  const admin = authorization
    ? hasCapability(authorization.capabilities, Capability.roleGrant) &&
      hasCapability(authorization.capabilities, Capability.accountDisable)
    : false;

  const links = [
    { href: "/", label: "Home" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/explore", label: "Explore issues" },
    ...(authorization
      ? [
          { href: "/my-issues", label: "My issues" },
          ...(staff ? [{ href: "/department", label: "Department" }] : []),
          ...(admin ? [{ href: "/admin", label: "Administration" }] : []),
          { href: "/account", label: "Account" },
        ]
      : [{ href: "/login", label: "Sign in" }]),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav aria-label="Public" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <MenuButton label="Menu">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
            {authorization ? <SignOutButton variant="ghost" className="mt-2 justify-start" /> : null}
          </MenuButton>
          {authorization ? (
            <SignOutButton variant="outline" className="hidden lg:inline-flex" />
          ) : null}
          <Button asChild>
            <Link href="/report" className="no-underline">
              Report an issue
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
