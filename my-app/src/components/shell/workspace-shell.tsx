import type { ReactNode } from "react";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { AppChrome, type ShellLink } from "@/components/shell/app-chrome";
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
  const staff = authorization
    ? hasCapability(authorization.capabilities, Capability.departmentWork)
    : false;
  const admin = authorization
    ? hasCapability(authorization.capabilities, Capability.roleGrant) &&
      hasCapability(authorization.capabilities, Capability.accountDisable)
    : false;

  if (area === "citizen" || area === "department") {
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
    return (
      <CitizenChrome title={title} lede={lede} profile={profile}>
        {children}
      </CitizenChrome>
    );
  }

  return (
    <AppChrome
      items={linksFor(area, staff, admin)}
      signedIn={Boolean(authorization)}
      title={title}
      lede={lede}
    >
      {children}
    </AppChrome>
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

function linksFor(area: "citizen" | "department" | "admin", staff: boolean, admin: boolean): ShellLink[] {
  if (area === "admin") {
    return [
      { href: "/admin", label: "Overview", group: "Overview" },
      { href: "/admin/departments", label: "Departments", group: "Setup" },
      { href: "/admin/categories", label: "Categories", group: "Setup" },
      { href: "/admin/users", label: "Users and staff", group: "Setup" },
      { href: "/admin/issues", label: "Reports", group: "Reports" },
      { href: "/account", label: "Account", group: "Account" },
    ];
  }
  if (area === "department") {
    return [
      { href: "/department", label: "Queue", group: "Queue" },
      { href: "/department?view=unassigned", label: "Reports to take", group: "Queue" },
      { href: "/account", label: "Account", group: "Account" },
      ...(admin ? [{ href: "/admin", label: "Administration", group: "Account" }] : []),
    ];
  }
  return [
    { href: "/report", label: "Report issue", group: "Reports" },
    { href: "/my-issues", label: "My issues", group: "Reports" },
    { href: "/account", label: "Account", group: "Account" },
    ...(staff ? [{ href: "/department", label: "Queue", group: "Account" }] : []),
    ...(admin ? [{ href: "/admin", label: "Administration", group: "Account" }] : []),
  ];
}
