import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import type { DepartmentStore } from "@/lib/issues/staff-service";
import type { StaffDatabase, StaffTx } from "@/lib/issues/staff-write";
import type { DepartmentIssue, IssueSummary } from "@/lib/issues/types";

function decimalText(value: { toString(): string } | string | null): string | null {
  if (value === null) return null;
  return value.toString();
}

const eligibleUser = {
  accountStatus: "ACTIVE" as const,
  disabledAt: null,
};

function adapt(tx: PrismaClient): StaffTx {
  return {
    async issue(id) {
      const issue = await tx.issue.findUnique({
        where: { id },
        select: {
          id: true,
          reporterId: true,
          title: true,
          status: true,
          deletedAt: true,
          createdAt: true,
          resolvedAt: true,
          closedAt: true,
        },
      });
      return issue;
    },
    async activeAssignment(issueId) {
      return tx.issueAssignment.findFirst({
        where: { issueId, endedAt: null },
        select: {
          id: true,
          issueId: true,
          departmentId: true,
          assigneeId: true,
          assignedById: true,
          note: true,
          endedAt: true,
        },
      });
    },
    async allows(fromStatus, toStatus) {
      const row = await tx.statusTransition.findUnique({
        where: { fromStatus_toStatus: { fromStatus, toStatus } },
        select: { fromStatus: true },
      });
      return row !== null;
    },
    async isMember(userId, departmentId) {
      const membership = await tx.departmentMembership.findFirst({
        where: { userId, departmentId, endedAt: null, user: eligibleUser },
        select: { id: true },
      });
      return membership !== null;
    },
    async endAssignment(id, endedAt) {
      await tx.issueAssignment.update({ where: { id }, data: { endedAt } });
    },
    async createAssignment(input) {
      await tx.issueAssignment.create({ data: input });
    },
    async updateAssignmentNote(id, note) {
      await tx.issueAssignment.update({ where: { id }, data: { note } });
    },
    async updateStatus(input) {
      await tx.issue.update({
        where: { id: input.issueId },
        data: {
          status: input.status,
          resolvedAt: input.resolvedAt,
          closedAt: input.closedAt,
        },
      });
    },
    async addHistory(input) {
      await tx.issueStatusHistory.create({ data: input });
    },
    async addComment(input) {
      const comment = await tx.issueComment.create({
        data: input,
        select: { id: true },
      });
      return comment;
    },
    async addAudit(input) {
      await tx.auditLog.create({ data: input });
    },
    async addNotification(input) {
      await tx.notification.create({ data: input });
    },
  };
}

async function claimableStatuses(prisma: PrismaClient) {
  const rows = await prisma.statusTransition.findMany({
    where: { toStatus: "ASSIGNED" },
    select: { fromStatus: true },
  });
  return rows.map((row) => row.fromStatus);
}

export function createPrismaDepartmentStore(): DepartmentStore {
  const prisma = getPrismaClient();
  const staffDb = (): StaffDatabase => ({
    $transaction(work) {
      return prisma.$transaction((tx) => work(adapt(tx as unknown as PrismaClient)));
    },
  });

  return {
    staffDb,
    async listQueue(departmentId, kind, page, pageSize) {
      if (kind === "unassigned") {
        const statuses = await claimableStatuses(prisma);
        if (statuses.length === 0) return { total: 0, items: [] };
      }
      const where =
        kind === "assigned"
          ? {
              deletedAt: null,
              assignments: { some: { departmentId, endedAt: null } },
            }
          : {
              deletedAt: null,
              status: { in: await claimableStatuses(prisma) },
              assignments: { none: { endedAt: null } },
            };
      const [total, rows] = await Promise.all([
        prisma.issue.count({ where }),
        prisma.issue.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            createdAt: true,
            category: { select: { name: true } },
            location: { select: { city: true } },
          },
        }),
      ]);
      const items: IssueSummary[] = rows.map((issue) => ({
        id: issue.id,
        title: issue.title,
        categoryName: issue.category.name,
        severity: issue.severity,
        status: issue.status,
        city: issue.location.city,
        createdAt: issue.createdAt,
      }));
      return { total, items };
    },
    async visibleIssue(departmentId, issueId): Promise<DepartmentIssue | null> {
      const issue = await prisma.issue.findFirst({
        where: { id: issueId, deletedAt: null },
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          status: true,
          createdAt: true,
          category: { select: { name: true } },
          location: {
            select: {
              description: true,
              locality: true,
              city: true,
              postalCode: true,
              latitude: true,
              longitude: true,
            },
          },
          statusHistory: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              fromStatus: true,
              toStatus: true,
              changedById: true,
              reason: true,
              createdAt: true,
            },
          },
          comments: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { name: true } },
            },
          },
          images: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true },
          },
          assignments: {
            where: { endedAt: null },
            take: 1,
            select: {
              departmentId: true,
              assigneeId: true,
              note: true,
              assignee: { select: { name: true } },
            },
          },
        },
      });
      if (!issue) return null;
      const active = issue.assignments[0] ?? null;
      if (active && active.departmentId !== departmentId) return null;
      if (!active) {
        const allowed = await prisma.statusTransition.findUnique({
          where: { fromStatus_toStatus: { fromStatus: issue.status, toStatus: "ASSIGNED" } },
          select: { fromStatus: true },
        });
        if (!allowed) return null;
      }
      return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        categoryName: issue.category.name,
        severity: issue.severity,
        status: issue.status,
        createdAt: issue.createdAt,
        location: {
          description: issue.location.description,
          locality: issue.location.locality,
          city: issue.location.city,
          postalCode: issue.location.postalCode,
          latitude: decimalText(issue.location.latitude),
          longitude: decimalText(issue.location.longitude),
        },
        history: issue.statusHistory,
        comments: issue.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          authorName: comment.author.name,
        })),
        images: issue.images,
        assignment: active
          ? {
              assigneeId: active.assigneeId,
              assigneeName: active.assignee?.name ?? null,
              note: active.note,
            }
          : null,
      };
    },
    async members(departmentId) {
      const rows = await prisma.departmentMembership.findMany({
        where: { departmentId, endedAt: null, user: eligibleUser },
        orderBy: { user: { name: "asc" } },
        select: { user: { select: { id: true, name: true } } },
      });
      return rows.map((row) => ({ id: row.user.id, name: row.user.name }));
    },
    async transitionsFrom(status) {
      const rows = await prisma.statusTransition.findMany({
        where: { fromStatus: status },
        select: { toStatus: true },
      });
      return rows.map((row) => row.toStatus);
    },
  };
}
