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
};

export function isEligible(user: StoredUser): boolean {
  if (user.accountStatus !== "ACTIVE" || user.disabledAt !== null || user.emailVerifiedAt === null) {
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
