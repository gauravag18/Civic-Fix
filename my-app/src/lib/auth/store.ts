export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  accountStatus: AccountStatus;
  disabledAt: Date | null;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  passwordCreatedAt?: Date | null;
  // True only when the staff.provision audit records admin activation.
  // Public registration never sets this, and emailVerifiedAt stays null.
  adminProvisioned?: boolean;
};

export type RegisterInput = {
  email: string;
  name: string;
  passwordHash: string;
  verificationTokenHash: Buffer;
  verificationExpiresAt: Date;
  now: Date;
};

export type AuthStore = {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  registerCitizen(
    input: RegisterInput,
  ): Promise<"created" | "duplicate" | "role_missing">;
  createGoogleCitizen(input: {
    email: string;
    name: string;
    now: Date;
  }): Promise<{ status: "created"; userId: string } | { status: "duplicate" } | { status: "role_missing" }>;
  issueVerificationToken(input: {
    email: string;
    tokenHash: Buffer;
    expiresAt: Date;
    now: Date;
  }): Promise<"issued" | "absent" | "already_verified">;
  consumeVerificationToken(
    tokenHash: Buffer,
    now: Date,
  ): Promise<"verified" | "invalid">;
  issueResetToken(input: {
    email: string;
    tokenHash: Buffer;
    expiresAt: Date;
    now: Date;
  }): Promise<"issued" | "absent" | "ineligible">;
  findResetAccount(
    tokenHash: Buffer,
    now: Date,
  ): Promise<{ email: string; name: string } | null>;
  consumeResetToken(input: {
    tokenHash: Buffer;
    passwordHash: string;
    now: Date;
  }): Promise<"reset" | "invalid">;
  activeRoleCodes(userId: string): Promise<string[]>;
  activeDepartmentId(userId: string): Promise<string | null>;
  grantRole(input: {
    actorUserId: string;
    targetUserId: string;
    roleCode: string;
    now: Date;
  }): Promise<
    | "granted"
    | "forbidden"
    | "self"
    | "missing_role"
    | "missing_user"
    | "already_active"
  >;
  disableAccount(input: {
    actorUserId: string;
    targetUserId: string;
    now: Date;
  }): Promise<"disabled" | "forbidden" | "self" | "missing">;
  changePassword(input: {
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<"changed" | "missing">;
};

export function isAdminProvisionedMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as Record<string, unknown>;
  return value.activation === "admin-activated" && value.emailVerified === "false";
}

// Public accounts must confirm their email. Admin-provisioned staff may sign in
// while emailVerifiedAt is null. That exception comes only from the provision audit.
export function isEligible(user: StoredUser): boolean {
  const identityAccepted = user.emailVerifiedAt !== null || user.adminProvisioned === true;
  if (user.accountStatus !== "ACTIVE" || user.disabledAt !== null || !identityAccepted) {
    return false;
  }
  if (user.passwordHash !== null || user.passwordChangedAt !== null) {
    return user.passwordHash !== null && user.passwordChangedAt !== null;
  }
  return true;
}

export function assessToken(
  user: StoredUser | null,
  passwordChangedAtMs: number | undefined,
  provider: "credentials" | "google" = "credentials",
): "ok" | "blocked" {
  if (!user || !isEligible(user)) return "blocked";
  if (user.passwordChangedAt) {
    return passwordChangedAtMs === user.passwordChangedAt.getTime() ? "ok" : "blocked";
  }
  return provider === "google" ? "ok" : "blocked";
}

export function mustReplaceProvisionedPassword(user: StoredUser): boolean {
  if (user.adminProvisioned !== true || !user.passwordCreatedAt || !user.passwordChangedAt) return false;
  return user.passwordCreatedAt.getTime() === user.passwordChangedAt.getTime();
}

export function sessionUserId(
  session: { user?: { id?: string | null } | null } | null | undefined,
): string | null {
  const id = session?.user?.id?.trim();
  return id ? id : null;
}

export class InactiveSessionError extends Error {
  constructor() {
    super("CivicFix session is not active.");
    this.name = "InactiveSessionError";
  }
}
