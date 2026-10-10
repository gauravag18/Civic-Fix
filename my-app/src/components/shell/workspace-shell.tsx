import type { ReactNode } from "react";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { getAuthorization } from "@/lib/auth/authorization";
import { AppChrome, type ShellLink } from "@/components/shell/app-chrome";
import { NotificationBell } from "@/components/shell/notification-bell";

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

  return (
    <AppChrome
      items={linksFor(area, staff, admin)}
      signedIn={Boolean(authorization)}
      title={title}
      lede={lede}
      bell={<NotificationBell />}
    >
      {children}
    </AppChrome>
  );
}

function linksFor(area: "citizen" | "department" | "admin", staff: boolean, admin: boolean): ShellLink[] {
  if (area === "admin") {
    return [
      { href: "/admin", label: "Overview" },
      { href: "/admin/departments", label: "Departments" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/users", label: "Users and staff" },
      { href: "/explore", label: "Explore issues" },
      { href: "/notifications", label: "Notifications" },
      { href: "/account", label: "Account" },
    ];
  }
  if (area === "department") {
    return [
      { href: "/department", label: "Department queue" },
      { href: "/department?view=unassigned", label: "Unassigned reports" },
      { href: "/explore", label: "Explore issues" },
      { href: "/notifications", label: "Notifications" },
      { href: "/account", label: "Account" },
      ...(admin ? [{ href: "/admin", label: "Administration" }] : []),
    ];
  }
  return [
    { href: "/report", label: "Report an issue" },
    { href: "/my-issues", label: "My issues" },
    { href: "/explore", label: "Explore issues" },
    { href: "/notifications", label: "Notifications" },
    { href: "/account", label: "Account" },
    ...(staff ? [{ href: "/department", label: "Department queue" }] : []),
    ...(admin ? [{ href: "/admin", label: "Administration" }] : []),
  ];
}
