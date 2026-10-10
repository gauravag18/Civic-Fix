import { isRoleCode, type RoleCode } from "@/lib/auth/roles";

const CODE = /^[A-Z0-9_]{2,64}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!CODE.test(code) || CONTROL.test(value)) return null;
  return code;
}

export function normalizeLabel(value: string, max: number): string | null {
  const label = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (!label || label.length > max || CONTROL.test(value)) return null;
  return label;
}

export function normalizeOptional(value: string, max: number): string | null | "invalid" {
  const text = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (CONTROL.test(value) || text.length > max) return "invalid";
  return text || null;
}

export function normalizeSortOrder(value: string): number | null {
  if (!/^\d{1,5}$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed > 10000) return null;
  return parsed;
}

export function normalizeSearch(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80);
}

export function roleFromForm(value: string): RoleCode | null {
  return isRoleCode(value) ? value : null;
}

export function deactivationBlock(
  activeAssignments: number,
  activeMemberships: number,
): "blocked" | null {
  if (activeAssignments > 0 || activeMemberships > 0) return "blocked";
  return null;
}

export function removesLastAdmin(activeAdmins: number): boolean {
  return activeAdmins <= 1;
}

export type BootstrapDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "confirm" | "identity" | "password" | "role" | "admin_exists" | "users_exist";
    };

// Bootstrap is allowed only for an empty user table with the ADMINISTRATOR role
// already seeded. Any existing user, including a non-admin, refuses the script.
export function decideBootstrap(input: {
  confirmed: boolean;
  email: string | null;
  name: string | null;
  passwordError: string | null;
  hasAdminRole: boolean;
  activeAdminCount: number;
  userCount: number;
}): BootstrapDecision {
  if (!input.confirmed) return { ok: false, reason: "confirm" };
  if (!input.email || !input.name) return { ok: false, reason: "identity" };
  if (input.passwordError) return { ok: false, reason: "password" };
  if (!input.hasAdminRole) return { ok: false, reason: "role" };
  if (input.activeAdminCount > 0) return { ok: false, reason: "admin_exists" };
  if (input.userCount > 0) return { ok: false, reason: "users_exist" };
  return { ok: true };
}
