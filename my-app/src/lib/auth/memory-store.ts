import { randomUUID } from "node:crypto";
import { isRoleCode } from "@/lib/auth/roles";
import type { AuthStore, RegisterInput, StoredUser } from "@/lib/auth/store";

type TokenRow = {
  userId: string;
  hash: Buffer;
  expiresAt: Date;
  consumedAt: Date | null;
};

type Grant = { userId: string; roleCode: string; revokedAt: Date | null };

export class MemoryAuthStore implements AuthStore {
  readonly users: StoredUser[] = [];
  readonly grants: Grant[] = [];
  readonly verifications: TokenRow[] = [];
  readonly resets: TokenRow[] = [];
  readonly revokedSessionUsers: string[] = [];
  readonly departments = new Map<string, string>();
  readonly roleCodes = new Set([
    "CITIZEN",
    "DEPARTMENT_STAFF",
    "MODERATOR",
    "ADMINISTRATOR",
  ]);

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async registerCitizen(input: RegisterInput): Promise<"created" | "duplicate" | "role_missing"> {
    if (!this.roleCodes.has("CITIZEN")) return "role_missing";
    if (this.users.some((user) => user.email === input.email)) return "duplicate";
    const user: StoredUser = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      accountStatus: "ACTIVE",
      disabledAt: null,
      emailVerifiedAt: null,
      passwordHash: input.passwordHash,
      passwordChangedAt: input.now,
    };
    this.users.push(user);
    this.grants.push({ userId: user.id, roleCode: "CITIZEN", revokedAt: null });
    this.verifications.push({
      userId: user.id,
      hash: input.verificationTokenHash,
      expiresAt: input.verificationExpiresAt,
      consumedAt: null,
    });
    return "created";
  }

  async createGoogleCitizen(input: {
    email: string;
    name: string;
    now: Date;
  }): Promise<{ status: "created"; userId: string } | { status: "duplicate" } | { status: "role_missing" }> {
    if (!this.roleCodes.has("CITIZEN")) return { status: "role_missing" };
    if (this.users.some((user) => user.email === input.email)) return { status: "duplicate" };
    const user: StoredUser = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      accountStatus: "ACTIVE",
      disabledAt: null,
      emailVerifiedAt: input.now,
      passwordHash: null,
      passwordChangedAt: null,
    };
    this.users.push(user);
    this.grants.push({ userId: user.id, roleCode: "CITIZEN", revokedAt: null });
    return { status: "created", userId: user.id };
  }

  async issueVerificationToken(input: {
    email: string;
    tokenHash: Buffer;
    expiresAt: Date;
    now: Date;
  }): Promise<"issued" | "absent" | "already_verified"> {
    const user = await this.findUserByEmail(input.email);
    if (!user) return "absent";
    if (user.emailVerifiedAt) return "already_verified";
    this.consumeOutstanding(this.verifications, user.id, input.now);
    this.verifications.push({
      userId: user.id,
      hash: input.tokenHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
    });
    return "issued";
  }

  async consumeVerificationToken(tokenHash: Buffer, now: Date): Promise<"verified" | "invalid"> {
    const token = this.findOpenToken(this.verifications, tokenHash, now);
    if (!token) return "invalid";
    token.consumedAt = now;
    const user = await this.findUserById(token.userId);
    if (!user) return "invalid";
    user.emailVerifiedAt = now;
    return "verified";
  }

  async issueResetToken(input: {
    email: string;
    tokenHash: Buffer;
    expiresAt: Date;
    now: Date;
  }): Promise<"issued" | "absent" | "ineligible"> {
    const user = await this.findUserByEmail(input.email);
    if (!user) return "absent";
    if (user.accountStatus !== "ACTIVE" || user.disabledAt) return "ineligible";
    this.consumeOutstanding(this.resets, user.id, input.now);
    this.resets.push({
      userId: user.id,
      hash: input.tokenHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
    });
    return "issued";
  }

  async findResetAccount(
    tokenHash: Buffer,
    now: Date,
  ): Promise<{ email: string; name: string } | null> {
    const token = this.findOpenToken(this.resets, tokenHash, now);
    if (!token) return null;
    const user = await this.findUserById(token.userId);
    if (!user || user.accountStatus !== "ACTIVE" || user.disabledAt) return null;
    return { email: user.email, name: user.name };
  }

  async consumeResetToken(input: {
    tokenHash: Buffer;
    passwordHash: string;
    now: Date;
  }): Promise<"reset" | "invalid"> {
    const token = this.findOpenToken(this.resets, input.tokenHash, input.now);
    if (!token) return "invalid";
    const user = await this.findUserById(token.userId);
    if (!user || user.accountStatus !== "ACTIVE" || user.disabledAt) return "invalid";
    token.consumedAt = input.now;
    this.consumeOutstanding(this.resets, user.id, input.now);
    user.passwordHash = input.passwordHash;
    user.passwordChangedAt = input.now;
    this.revokedSessionUsers.push(user.id);
    return "reset";
  }

  async activeRoleCodes(userId: string): Promise<string[]> {
    return this.grants
      .filter((grant) => grant.userId === userId && grant.revokedAt === null)
      .map((grant) => grant.roleCode);
  }

  async activeDepartmentId(userId: string): Promise<string | null> {
    return this.departments.get(userId) ?? null;
  }

  async grantRole(input: {
    actorUserId: string;
    targetUserId: string;
    roleCode: string;
    now: Date;
  }): Promise<"granted" | "forbidden" | "self" | "missing_role" | "missing_user" | "already_active"> {
    if (input.actorUserId === input.targetUserId) return "self";
    const actorRoles = await this.activeRoleCodes(input.actorUserId);
    if (!actorRoles.includes("ADMINISTRATOR")) return "forbidden";
    if (!isRoleCode(input.roleCode) || !this.roleCodes.has(input.roleCode)) {
      return "missing_role";
    }
    const target = await this.findUserById(input.targetUserId);
    if (!target) return "missing_user";
    const existing = this.grants.find(
      (grant) =>
        grant.userId === input.targetUserId &&
        grant.roleCode === input.roleCode &&
        grant.revokedAt === null,
    );
    if (existing) return "already_active";
    this.grants.push({
      userId: input.targetUserId,
      roleCode: input.roleCode,
      revokedAt: null,
    });
    void input.now;
    return "granted";
  }

  async disableAccount(input: {
    actorUserId: string;
    targetUserId: string;
    now: Date;
  }): Promise<"disabled" | "forbidden" | "self" | "missing"> {
    if (input.actorUserId === input.targetUserId) return "self";
    const actorRoles = await this.activeRoleCodes(input.actorUserId);
    if (!actorRoles.includes("ADMINISTRATOR")) return "forbidden";
    const target = await this.findUserById(input.targetUserId);
    if (!target) return "missing";
    target.accountStatus = "DISABLED";
    target.disabledAt = input.now;
    this.revokedSessionUsers.push(target.id);
    return "disabled";
  }

  private findOpenToken(rows: TokenRow[], tokenHash: Buffer, now: Date): TokenRow | null {
    return (
      rows.find(
        (row) =>
          row.hash.equals(tokenHash) &&
          row.consumedAt === null &&
          row.expiresAt.getTime() > now.getTime(),
      ) ?? null
    );
  }

  private consumeOutstanding(rows: TokenRow[], userId: string, now: Date): void {
    for (const row of rows) {
      if (row.userId === userId && row.consumedAt === null) row.consumedAt = now;
    }
  }
}
