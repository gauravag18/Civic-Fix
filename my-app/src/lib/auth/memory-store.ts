import { randomUUID } from "node:crypto";
import { isRoleCode } from "@/lib/auth/roles";
import type { AuthStore, RegisterInput, StoredUser } from "@/lib/auth/store";

type Grant = { userId: string; roleCode: string; revokedAt: Date | null };

export class MemoryAuthStore implements AuthStore {
  readonly users: StoredUser[] = [];
  readonly grants: Grant[] = [];
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
      passwordHash: input.passwordHash,
      passwordChangedAt: input.now,
      passwordCreatedAt: input.now,
    };
    this.users.push(user);
    this.grants.push({ userId: user.id, roleCode: "CITIZEN", revokedAt: null });
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
      passwordHash: null,
      passwordChangedAt: null,
    };
    this.users.push(user);
    this.grants.push({ userId: user.id, roleCode: "CITIZEN", revokedAt: null });
    return { status: "created", userId: user.id };
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

  async changePassword(input: {
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<"changed" | "missing"> {
    const user = await this.findUserById(input.userId);
    if (!user || !user.passwordHash) return "missing";
    user.passwordHash = input.passwordHash;
    user.passwordChangedAt = input.now;
    return "changed";
  }
}
