import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { deactivationBlock, removesLastAdmin } from "@/lib/admin/rules";
import type { AdminStore, AdminWriteResult } from "@/lib/admin/store";
import { ISSUE_STATUSES } from "@/lib/admin/types";
import { isRoleCode } from "@/lib/auth/roles";

function duplicate(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function audit(
  tx: PrismaClient,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, string | null>;
    ipAddress: string | null;
    now: Date;
  },
) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
      createdAt: input.now,
    },
  });
}

async function countedAdmins(tx: PrismaClient): Promise<number> {
  return tx.userRole.count({
    where: {
      revokedAt: null,
      role: { code: "ADMINISTRATOR" },
      user: { accountStatus: "ACTIVE", disabledAt: null },
    },
  });
}

export function createPrismaAdminStore(): AdminStore {
  const prisma = getPrismaClient();
  const txClient = (tx: unknown) => tx as PrismaClient;

  return {
    async counts() {
      const [issues, grouped, activeDepartments, departments, activeMemberships, users, categories, activeCategories] =
        await Promise.all([
          prisma.issue.count(),
          prisma.issue.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.department.count({ where: { isActive: true } }),
          prisma.department.count(),
          prisma.departmentMembership.count({ where: { endedAt: null } }),
          prisma.user.count(),
          prisma.issueCategory.count(),
          prisma.issueCategory.count({ where: { isActive: true } }),
        ]);
      const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
      return {
        issues,
        issuesByStatus: ISSUE_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 })),
        activeDepartments,
        departments,
        activeMemberships,
        users,
        categories,
        activeCategories,
      };
    },

    async searchDepartments(query, page, pageSize) {
      const where = query
        ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { code: { contains: query, mode: "insensitive" as const } }] }
        : {};
      const [total, rows] = await Promise.all([
        prisma.department.count({ where }),
        prisma.department.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            _count: {
              select: {
                memberships: { where: { endedAt: null } },
                assignments: { where: { endedAt: null } },
              },
            },
          },
        }),
      ]);
      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          isActive: row.isActive,
          activeMemberships: row._count.memberships,
          activeAssignments: row._count.assignments,
        })),
      };
    },

    async getDepartment(id) {
      const department = await prisma.department.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          memberships: {
            where: { endedAt: null },
            orderBy: { startedAt: "asc" },
            select: {
              id: true,
              userId: true,
              startedAt: true,
              user: { select: { name: true, email: true } },
            },
          },
          _count: { select: { assignments: { where: { endedAt: null } } } },
        },
      });
      if (!department) return null;
      return {
        id: department.id,
        code: department.code,
        name: department.name,
        description: department.description,
        isActive: department.isActive,
        createdAt: department.createdAt,
        activeAssignments: department._count.assignments,
        memberships: department.memberships.map((membership) => ({
          id: membership.id,
          userId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          startedAt: membership.startedAt,
        })),
      };
    },

    async eligibleStaff(departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, isActive: true },
        select: { id: true },
      });
      if (!department) return [];
      const rows = await prisma.user.findMany({
        where: {
          accountStatus: "ACTIVE",
          disabledAt: null,
          emailVerifiedAt: { not: null },
          rolesReceived: { some: { revokedAt: null, role: { code: "DEPARTMENT_STAFF" } } },
          departmentMemberships: { none: { endedAt: null } },
        },
        orderBy: { name: "asc" },
        take: 100,
        select: { id: true, name: true, email: true },
      });
      return rows;
    },

    async createDepartment(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const department = await db.department.create({
            data: {
              code: input.code,
              name: input.name,
              description: input.description,
              isActive: true,
              createdAt: input.now,
            },
            select: { id: true },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "department.create",
            entityType: "Department",
            entityId: department.id,
            metadata: { code: input.code },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: department.id };
        });
      } catch (error) {
        if (duplicate(error)) return { ok: false, reason: "duplicate" };
        console.error("Department create failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async updateDepartment(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const existing = await db.department.findUnique({ where: { id: input.id }, select: { id: true, code: true } });
          if (!existing) return { ok: false as const, reason: "missing" as const };
          await db.department.update({
            where: { id: existing.id },
            data: { name: input.name, description: input.description },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "department.update",
            entityType: "Department",
            entityId: existing.id,
            metadata: { code: existing.code },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: existing.id };
        });
      } catch (error) {
        if (duplicate(error)) return { ok: false, reason: "duplicate" };
        console.error("Department update failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async setDepartmentActive(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const department = await db.department.findUnique({
            where: { id: input.id },
            select: {
              id: true,
              code: true,
              _count: {
                select: {
                  memberships: { where: { endedAt: null } },
                  assignments: { where: { endedAt: null } },
                },
              },
            },
          });
          if (!department) return { ok: false as const, reason: "missing" as const };
          if (
            !input.isActive &&
            deactivationBlock(department._count.assignments, department._count.memberships)
          ) {
            return { ok: false as const, reason: "blocked" as const };
          }
          await db.department.update({ where: { id: department.id }, data: { isActive: input.isActive } });
          await audit(db, {
            actorId: input.actorId,
            action: input.isActive ? "department.activate" : "department.deactivate",
            entityType: "Department",
            entityId: department.id,
            metadata: { code: department.code },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: department.id };
        });
      } catch {
        console.error("Department status change failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async addMembership(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const department = await db.department.findFirst({
            where: { id: input.departmentId, isActive: true },
            select: { id: true },
          });
          const user = await db.user.findFirst({
            where: {
              id: input.userId,
              accountStatus: "ACTIVE",
              disabledAt: null,
              emailVerifiedAt: { not: null },
              rolesReceived: { some: { revokedAt: null, role: { code: "DEPARTMENT_STAFF" } } },
              departmentMemberships: { none: { endedAt: null } },
            },
            select: { id: true },
          });
          if (!department || !user) return { ok: false as const, reason: "membership" as const };
          const membership = await db.departmentMembership.create({
            data: {
              userId: user.id,
              departmentId: department.id,
              startedAt: input.now,
            },
            select: { id: true },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "membership.start",
            entityType: "DepartmentMembership",
            entityId: membership.id,
            metadata: { departmentId: department.id, userId: user.id },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: membership.id };
        });
      } catch (error) {
        if (duplicate(error)) return { ok: false, reason: "membership" };
        console.error("Membership create failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async endMembership(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const membership = await db.departmentMembership.findFirst({
            where: { id: input.membershipId, endedAt: null },
            select: { id: true, userId: true, departmentId: true },
          });
          if (!membership) return { ok: false as const, reason: "missing" as const };
          await db.departmentMembership.update({
            where: { id: membership.id },
            data: { endedAt: input.now },
          });
          const cleared = await db.issueAssignment.updateMany({
            where: {
              departmentId: membership.departmentId,
              assigneeId: membership.userId,
              endedAt: null,
            },
            data: { assigneeId: null },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "membership.end",
            entityType: "DepartmentMembership",
            entityId: membership.id,
            metadata: {
              departmentId: membership.departmentId,
              userId: membership.userId,
              clearedAssignees: String(cleared.count),
            },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: membership.id };
        });
      } catch {
        console.error("Membership end failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async searchCategories(query, page, pageSize) {
      const where = query
        ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { code: { contains: query, mode: "insensitive" as const } }] }
        : {};
      const [total, rows] = await Promise.all([
        prisma.issueCategory.count({ where }),
        prisma.issueCategory.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            sortOrder: true,
            _count: { select: { issues: true } },
          },
        }),
      ]);
      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          issueCount: row._count.issues,
        })),
      };
    },

    async getCategory(id) {
      const category = await prisma.issueCategory.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          sortOrder: true,
          _count: { select: { issues: true } },
        },
      });
      if (!category) return null;
      return { ...category, issueCount: category._count.issues };
    },

    async createCategory(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const category = await db.issueCategory.create({
            data: {
              code: input.code,
              name: input.name,
              sortOrder: input.sortOrder,
              isActive: true,
            },
            select: { id: true },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "category.create",
            entityType: "IssueCategory",
            entityId: category.id,
            metadata: { code: input.code },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: category.id };
        });
      } catch (error) {
        if (duplicate(error)) return { ok: false, reason: "duplicate" };
        console.error("Category create failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async updateCategory(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const existing = await db.issueCategory.findUnique({
            where: { id: input.id },
            select: { id: true, code: true },
          });
          if (!existing) return { ok: false as const, reason: "missing" as const };
          await db.issueCategory.update({
            where: { id: existing.id },
            data: { name: input.name, sortOrder: input.sortOrder },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "category.update",
            entityType: "IssueCategory",
            entityId: existing.id,
            metadata: { code: existing.code },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: existing.id };
        });
      } catch (error) {
        if (duplicate(error)) return { ok: false, reason: "duplicate" };
        console.error("Category update failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async setCategoryActive(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const category = await db.issueCategory.findUnique({
            where: { id: input.id },
            select: { id: true, code: true },
          });
          if (!category) return { ok: false as const, reason: "missing" as const };
          await db.issueCategory.update({ where: { id: category.id }, data: { isActive: input.isActive } });
          await audit(db, {
            actorId: input.actorId,
            action: input.isActive ? "category.activate" : "category.deactivate",
            entityType: "IssueCategory",
            entityId: category.id,
            metadata: { code: category.code },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: category.id };
        });
      } catch {
        console.error("Category status change failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async searchUsers(query, page, pageSize) {
      const where = query
        ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { email: { contains: query, mode: "insensitive" as const } }] }
        : {};
      const [total, rows] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: userSelect,
        }),
      ]);
      return {
        total,
        items: rows.map((row) => {
          const user = mapUser(row);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            accountStatus: user.accountStatus,
            roles: user.roles,
            departmentName: user.departmentName,
          };
        }),
      };
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
      if (!user) return null;
      return mapUser(user);
    },

    async setAccountStatus(input) {
      if (input.actorId === input.userId) return { ok: false, reason: "self" };
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const user = await db.user.findUnique({
            where: { id: input.userId },
            select: {
              id: true,
              accountStatus: true,
              disabledAt: true,
              rolesReceived: { where: { revokedAt: null, role: { code: "ADMINISTRATOR" } }, select: { id: true } },
            },
          });
          if (!user) return { ok: false as const, reason: "missing" as const };
          const isAdmin = user.rolesReceived.length > 0 && user.accountStatus === "ACTIVE" && user.disabledAt === null;
          if (input.status !== "ACTIVE" && isAdmin && removesLastAdmin(await countedAdmins(db))) {
            return { ok: false as const, reason: "last_admin" as const };
          }
          await db.user.update({
            where: { id: user.id },
            data: {
              accountStatus: input.status,
              disabledAt: input.status === "DISABLED" ? input.now : input.status === "ACTIVE" ? null : undefined,
            },
          });
          if (input.status !== "ACTIVE") {
            await db.session.updateMany({
              where: { userId: user.id, revokedAt: null },
              data: { revokedAt: input.now },
            });
          }
          await audit(db, {
            actorId: input.actorId,
            action: "user.status",
            entityType: "User",
            entityId: user.id,
            metadata: { status: input.status },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: user.id };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch {
        console.error("Account status change failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async grantRole(input) {
      if (input.actorId === input.userId) return { ok: false, reason: "self" };
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const role = await db.role.findUnique({ where: { code: input.role }, select: { id: true } });
          const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
          if (!role || !user) return { ok: false as const, reason: "role" as const };
          const existing = await db.userRole.findFirst({
            where: { userId: user.id, roleId: role.id, revokedAt: null },
            select: { id: true },
          });
          if (existing) return { ok: false as const, reason: "role" as const };
          const grant = await db.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
              assignedById: input.actorId,
              assignedAt: input.now,
            },
            select: { id: true },
          });
          await audit(db, {
            actorId: input.actorId,
            action: "role.grant",
            entityType: "UserRole",
            entityId: grant.id,
            metadata: { role: input.role, userId: user.id },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: grant.id };
        });
      } catch (error) {
        if (duplicate(error)) return { ok: false, reason: "role" };
        console.error("Role grant failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async revokeRole(input) {
      if (input.actorId === input.userId) return { ok: false, reason: "self" };
      try {
        return await prisma.$transaction(async (tx) => {
          const db = txClient(tx);
          const grant = await db.userRole.findFirst({
            where: { userId: input.userId, revokedAt: null, role: { code: input.role } },
            select: { id: true, user: { select: { accountStatus: true, disabledAt: true } } },
          });
          if (!grant) return { ok: false as const, reason: "missing" as const };
          const counted =
            input.role === "ADMINISTRATOR" &&
            grant.user.accountStatus === "ACTIVE" &&
            grant.user.disabledAt === null;
          if (counted && removesLastAdmin(await countedAdmins(db))) {
            return { ok: false as const, reason: "last_admin" as const };
          }
          await db.userRole.update({ where: { id: grant.id }, data: { revokedAt: input.now } });
          await audit(db, {
            actorId: input.actorId,
            action: "role.revoke",
            entityType: "UserRole",
            entityId: grant.id,
            metadata: { role: input.role, userId: input.userId },
            ipAddress: input.ipAddress,
            now: input.now,
          });
          return { ok: true as const, id: grant.id };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch {
        console.error("Role revoke failed.");
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  accountStatus: true,
  emailVerifiedAt: true,
  disabledAt: true,
  rolesReceived: {
    where: { revokedAt: null },
    select: { role: { select: { code: true } } },
  },
  departmentMemberships: {
    where: { endedAt: null },
    take: 1,
    select: { department: { select: { id: true, name: true } } },
  },
} as const;

function mapUser(user: {
  id: string;
  email: string;
  name: string;
  accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED";
  emailVerifiedAt: Date | null;
  disabledAt: Date | null;
  rolesReceived: { role: { code: string } }[];
  departmentMemberships: { department: { id: string; name: string } }[];
}) {
  const roles = user.rolesReceived.map((grant) => grant.role.code).filter(isRoleCode);
  const department = user.departmentMemberships[0]?.department;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountStatus: user.accountStatus,
    roles,
    departmentName: department?.name ?? null,
    emailVerifiedAt: user.emailVerifiedAt,
    disabledAt: user.disabledAt,
    departmentId: department?.id ?? null,
  };
}
