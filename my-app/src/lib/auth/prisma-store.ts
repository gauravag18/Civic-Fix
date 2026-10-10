import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { isRoleCode } from "@/lib/auth/roles";
import { isAdminProvisionedMetadata, type AuthStore, type RegisterInput, type StoredUser } from "@/lib/auth/store";

function bytes(value: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function mapUser(user: {
  id: string;
  email: string;
  name: string;
  accountStatus: StoredUser["accountStatus"];
  disabledAt: Date | null;
  emailVerifiedAt: Date | null;
  credential: { passwordHash: string; passwordChangedAt: Date; createdAt: Date } | null;
}): StoredUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountStatus: user.accountStatus,
    disabledAt: user.disabledAt,
    emailVerifiedAt: user.emailVerifiedAt,
    passwordHash: user.credential?.passwordHash ?? null,
    passwordChangedAt: user.credential?.passwordChangedAt ?? null,
    passwordCreatedAt: user.credential?.createdAt ?? null,
    adminProvisioned: false,
  };
}

export function createPrismaAuthStore(): AuthStore {
  const db = getPrismaClient();

  async function storedUser(user: Parameters<typeof mapUser>[0]): Promise<StoredUser> {
    const mapped = mapUser(user);
    const audit = await db.auditLog.findFirst({
      where: { action: "staff.provision", entityType: "User", entityId: user.id },
      select: { metadata: true },
    });
    mapped.adminProvisioned = isAdminProvisionedMetadata(audit?.metadata);
    return mapped;
  }

  return {
    async findUserByEmail(email) {
      const user = await db.user.findUnique({
        where: { email },
        include: { credential: true },
      });
      return user ? storedUser(user) : null;
    },
    async findUserById(id) {
      const user = await db.user.findUnique({
        where: { id },
        include: { credential: true },
      });
      return user ? storedUser(user) : null;
    },
    async registerCitizen(input: RegisterInput) {
      try {
        return await db.$transaction(async (tx) => {
          const role = await tx.role.findUnique({ where: { code: "CITIZEN" } });
          if (!role) return "role_missing" as const;
          const user = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              accountStatus: "ACTIVE",
              createdAt: input.now,
            },
          });
          await tx.userCredential.create({
            data: {
              userId: user.id,
              passwordHash: input.passwordHash,
              createdAt: input.now,
              passwordChangedAt: input.now,
            },
          });
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
              assignedAt: input.now,
            },
          });
          await tx.emailVerificationToken.create({
            data: {
              userId: user.id,
              tokenHash: bytes(input.verificationTokenHash),
              expiresAt: input.verificationExpiresAt,
              createdAt: input.now,
            },
          });
          return "created" as const;
        });
      } catch (error) {
        if (isUniqueViolation(error)) return "duplicate";
        throw error;
      }
    },
    async createGoogleCitizen(input) {
      try {
        return await db.$transaction(async (tx) => {
          const role = await tx.role.findUnique({ where: { code: "CITIZEN" } });
          if (!role) return { status: "role_missing" as const };
          const user = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              accountStatus: "ACTIVE",
              emailVerifiedAt: input.now,
              createdAt: input.now,
            },
          });
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
              assignedAt: input.now,
            },
          });
          return { status: "created" as const, userId: user.id };
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { status: "duplicate" as const };
        throw error;
      }
    },
    async issueVerificationToken(input) {
      const user = await db.user.findUnique({ where: { email: input.email } });
      if (!user) return "absent";
      if (user.emailVerifiedAt) return "already_verified";
      await db.$transaction(async (tx) => {
        await tx.emailVerificationToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: input.now },
        });
        await tx.emailVerificationToken.create({
          data: {
            userId: user.id,
            tokenHash: bytes(input.tokenHash),
            expiresAt: input.expiresAt,
            createdAt: input.now,
          },
        });
      });
      return "issued";
    },
    async consumeVerificationToken(tokenHash, now) {
      const hashed = bytes(tokenHash);
      return db.$transaction(async (tx) => {
        const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashed } });
        if (!token || token.consumedAt || token.expiresAt <= now) return "invalid" as const;
        const updated = await tx.emailVerificationToken.updateMany({
          where: { id: token.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (updated.count !== 1) return "invalid" as const;
        await tx.user.update({
          where: { id: token.userId },
          data: { emailVerifiedAt: now },
        });
        return "verified" as const;
      });
    },
    async issueResetToken(input) {
      const user = await db.user.findUnique({ where: { email: input.email } });
      if (!user) return "absent";
      if (user.accountStatus !== "ACTIVE" || user.disabledAt) return "ineligible";
      await db.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: input.now },
        });
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: bytes(input.tokenHash),
            expiresAt: input.expiresAt,
            createdAt: input.now,
          },
        });
      });
      return "issued";
    },
    async findResetAccount(tokenHash, now) {
      const hashed = bytes(tokenHash);
      const token = await db.passwordResetToken.findUnique({
        where: { tokenHash: hashed },
        include: {
          user: {
            select: { email: true, name: true, accountStatus: true, disabledAt: true },
          },
        },
      });
      if (!token || token.consumedAt || token.expiresAt <= now) return null;
      if (token.user.accountStatus !== "ACTIVE" || token.user.disabledAt) return null;
      return { email: token.user.email, name: token.user.name };
    },
    async consumeResetToken(input) {
      const hashed = bytes(input.tokenHash);
      return db.$transaction(async (tx) => {
        const token = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashed } });
        if (!token || token.consumedAt || token.expiresAt <= input.now) return "invalid" as const;
        const user = await tx.user.findUnique({ where: { id: token.userId } });
        if (!user || user.accountStatus !== "ACTIVE" || user.disabledAt) return "invalid" as const;
        const updated = await tx.passwordResetToken.updateMany({
          where: { id: token.id, consumedAt: null, expiresAt: { gt: input.now } },
          data: { consumedAt: input.now },
        });
        if (updated.count !== 1) return "invalid" as const;
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: input.now },
        });
        await tx.userCredential.update({
          where: { userId: user.id },
          data: { passwordHash: input.passwordHash, passwordChangedAt: input.now },
        });
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return "reset" as const;
      });
    },
    async activeRoleCodes(userId) {
      const grants = await db.userRole.findMany({
        where: { userId, revokedAt: null },
        include: { role: true },
      });
      return grants.map((grant) => grant.role.code);
    },
    async activeDepartmentId(userId) {
      const membership = await db.departmentMembership.findFirst({
        where: { userId, endedAt: null },
        select: { departmentId: true },
      });
      return membership?.departmentId ?? null;
    },
    async grantRole(input) {
      if (input.actorUserId === input.targetUserId) return "self";
      if (!isRoleCode(input.roleCode)) return "missing_role";
      return db.$transaction(async (tx) => {
        const actorGrant = await tx.userRole.findFirst({
          where: {
            userId: input.actorUserId,
            revokedAt: null,
            role: { code: "ADMINISTRATOR" },
          },
        });
        if (!actorGrant) return "forbidden" as const;
        const role = await tx.role.findUnique({ where: { code: input.roleCode } });
        if (!role) return "missing_role" as const;
        const target = await tx.user.findUnique({ where: { id: input.targetUserId } });
        if (!target) return "missing_user" as const;
        const existing = await tx.userRole.findFirst({
          where: { userId: input.targetUserId, roleId: role.id, revokedAt: null },
        });
        if (existing) return "already_active" as const;
        await tx.userRole.create({
          data: {
            userId: input.targetUserId,
            roleId: role.id,
            assignedById: input.actorUserId,
            assignedAt: input.now,
          },
        });
        return "granted" as const;
      });
    },
    async disableAccount(input) {
      if (input.actorUserId === input.targetUserId) return "self";
      return db.$transaction(async (tx) => {
        const actorGrant = await tx.userRole.findFirst({
          where: {
            userId: input.actorUserId,
            revokedAt: null,
            role: { code: "ADMINISTRATOR" },
          },
        });
        if (!actorGrant) return "forbidden" as const;
        const target = await tx.user.findUnique({ where: { id: input.targetUserId } });
        if (!target) return "missing" as const;
        await tx.user.update({
          where: { id: target.id },
          data: { accountStatus: "DISABLED", disabledAt: input.now },
        });
        await tx.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return "disabled" as const;
      });
    },
    async changePassword(input) {
      try {
        return await db.$transaction(async (tx) => {
          const credential = await tx.userCredential.findUnique({
            where: { userId: input.userId },
            select: { id: true },
          });
          if (!credential) return "missing" as const;
          await tx.userCredential.update({
            where: { userId: input.userId },
            data: { passwordHash: input.passwordHash, passwordChangedAt: input.now },
          });
          await tx.auditLog.create({
            data: {
              actorId: input.userId,
              action: "password.change",
              entityType: "User",
              entityId: input.userId,
              metadata: {},
              createdAt: input.now,
            },
          });
          return "changed" as const;
        });
      } catch {
        console.error("Password change failed.");
        return "missing";
      }
    },
  };
}
