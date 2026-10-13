import type { ReactNode } from "react";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { AdminChrome } from "@/components/shell/admin-chrome";
import { CitizenChrome } from "@/components/shell/citizen-chrome";
import { DepartmentChrome } from "@/components/shell/department-chrome";

export async function WorkspaceShell({
  area,
  title,
  lede,
  children,
}: {
  area: "citizen" | "department" | "admin";
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const authorization = await getAuthorization();
  const admin = authorization
    ? hasCapability(authorization.capabilities, Capability.roleGrant) &&
      hasCapability(authorization.capabilities, Capability.accountDisable)
    : false;
  const profile = authorization
    ? {
        name: authorization.name,
        email: authorization.email,
        role: citizenRoleLabel(authorization.roleCodes),
      }
    : null;

  if (area === "department") {
    return (
      <DepartmentChrome title={title} lede={lede} profile={profile} showAdmin={admin}>
        {children}
      </DepartmentChrome>
    );
  }
  if (area === "admin") {
    return (
      <AdminChrome title={title} lede={lede} profile={profile}>
        {children}
      </AdminChrome>
    );
  }
  return (
    <CitizenChrome title={title} lede={lede} profile={profile}>
      {children}
    </CitizenChrome>
  );
}

function citizenRoleLabel(roleCodes: string[]): string {
  if (roleCodes.includes("CITIZEN") && !roleCodes.includes("DEPARTMENT_STAFF") && !roleCodes.includes("ADMINISTRATOR")) {
    return "Citizen";
  }
  if (roleCodes.includes("ADMINISTRATOR")) return "Administrator";
  if (roleCodes.includes("DEPARTMENT_STAFF")) return "Department staff";
  if (roleCodes.includes("MODERATOR")) return "Moderator";
  if (roleCodes.includes("CITIZEN")) return "Citizen";
  return "Citizen";
}

