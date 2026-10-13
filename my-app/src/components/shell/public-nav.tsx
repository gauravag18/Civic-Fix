import Link from "next/link";
import { getAuthorization } from "@/lib/auth/authorization";
import { workspaceOf } from "@/lib/auth/home-path";
import { AdminNav } from "@/components/shell/admin-chrome";
import { CitizenNavLinks, type CitizenProfile } from "@/components/shell/citizen-chrome";
import { DepartmentNav } from "@/components/shell/department-chrome";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

function roleLabel(roleCodes: string[]): string {
  if (roleCodes.includes("CITIZEN") && !roleCodes.includes("DEPARTMENT_STAFF") && !roleCodes.includes("ADMINISTRATOR")) {
    return "Citizen";
  }
  if (roleCodes.includes("ADMINISTRATOR")) return "Administrator";
  if (roleCodes.includes("DEPARTMENT_STAFF")) return "Department staff";
  if (roleCodes.includes("MODERATOR")) return "Moderator";
  return "Citizen";
}

export async function PublicNav() {
  const authorization = await getAuthorization();
  const workspace = workspaceOf(authorization);
  const profile: CitizenProfile | null = authorization
    ? {
        name: authorization.name,
        email: authorization.email,
        role: roleLabel(authorization.roleCodes),
      }
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-6">
        <Wordmark icon={false} />
        {profile && workspace === "department" ? (
          <DepartmentNav profile={profile} showAdmin={profile.role === "Administrator"} />
        ) : null}
        {profile && workspace === "admin" ? <AdminNav profile={profile} /> : null}
        {profile && workspace === "citizen" ? <CitizenNavLinks profile={profile} /> : null}
        {profile ? null : (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Register</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
