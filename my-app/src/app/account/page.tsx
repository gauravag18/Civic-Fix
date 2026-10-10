import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { SignOutButton } from "@/components/sign-out-button";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";

export default async function AccountPage() {
  const authorization = await getAuthorization();

  return (
    <AuthPage
      title="Account"
      lede="Your access is checked on the server from active role grants."
    >
      {authorization ? (
        <div className="flex flex-col gap-4">
          <dl className="border border-border text-small">
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
              <dt className="font-semibold">Name</dt>
              <dd>{authorization.name}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="font-semibold">Email</dt>
              <dd>{authorization.email}</dd>
            </div>
          </dl>
          <p className="text-small">
            <Link href="/report">Report an issue</Link>
            {" · "}
            <Link href="/my-issues">My reports</Link>
            {hasCapability(authorization.capabilities, Capability.departmentWork) ? (
              <>
                {" · "}
                <Link href="/department">Department queue</Link>
              </>
            ) : null}
            {hasCapability(authorization.capabilities, Capability.roleGrant) &&
            hasCapability(authorization.capabilities, Capability.accountDisable) ? (
              <>
                {" · "}
                <Link href="/admin">Administration</Link>
              </>
            ) : null}
          </p>
          <SignOutButton />
        </div>
      ) : (
        <p>
          You are not logged in. <Link href="/login">Log in</Link>
        </p>
      )}
    </AuthPage>
  );
}
