import Link from "next/link";
import { getAuthorization } from "@/lib/auth/authorization";
import { CitizenNavLinks, type CitizenProfile } from "@/components/shell/citizen-chrome";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

function citizenRole(roleCodes: string[]): string {
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
  const profile: CitizenProfile | null = authorization
    ? {
        name: authorization.name,
        email: authorization.email,
        role: citizenRole(authorization.roleCodes),
      }
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Wordmark icon={false} />
        {profile ? (
          <CitizenNavLinks profile={profile} />
        ) : (
          <div className="ml-auto flex items-center gap-2">
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
