import { Capability, hasCapability } from "@/lib/auth/capabilities";

type Access = { capabilities: ReadonlySet<string> } | null;

export type Workspace = "department" | "admin" | "citizen";

export function workspaceOf(authorization: Access): Workspace | null {
  if (!authorization) return null;
  if (hasCapability(authorization.capabilities, Capability.departmentWork)) return "department";
  if (
    hasCapability(authorization.capabilities, Capability.roleGrant) &&
    hasCapability(authorization.capabilities, Capability.accountDisable)
  ) {
    return "admin";
  }
  return "citizen";
}

export function homePath(authorization: Access): string {
  const workspace = workspaceOf(authorization);
  if (workspace === "department") return "/department";
  if (workspace === "admin") return "/admin";
  if (workspace === "citizen") return "/my-issues";
  return "/login";
}
