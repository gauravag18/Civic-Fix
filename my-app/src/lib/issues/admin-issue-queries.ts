import "server-only";

import { getAuthorization } from "@/lib/auth/authorization";
import type { AdminAccess } from "@/lib/admin/types";
import {
  browseAdminIssues,
  inspectAdminIssue,
  type AdminIssueInspection,
  type AdminIssueListResult,
  type AdminIssueReadStore,
  type AdminIssueSummary,
} from "@/lib/issues/admin-issues";
import { getPrismaClient } from "@/lib/prisma";

function adminAccess(): Promise<AdminAccess> {
  return getAuthorization().then((authorization) =>
    authorization ? { userId: authorization.userId, capabilities: authorization.capabilities } : null,
  );
}

export function createAdminIssueReadStore(): AdminIssueReadStore {
  const prisma = getPrismaClient();
  return {
    async search(query, page, pageSize): Promise<{ total: number; items: AdminIssueSummary[] }> {
      const where = query
        ? { title: { contains: query, mode: "insensitive" as const } }
        : {};
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
            deletedAt: true,
            category: { select: { name: true } },
            reporter: { select: { name: true } },
            assignments: {
              where: { endedAt: null },
              take: 1,
              select: {
                department: { select: { name: true } },
                assignee: { select: { name: true } },
              },
            },
          },
        }),
      ]);
      return {
        total,
        items: rows.map((issue) => {
          const assignment = issue.assignments[0] ?? null;
          return {
            id: issue.id,
            title: issue.title,
            categoryName: issue.category.name,
            severity: issue.severity,
            status: issue.status,
            createdAt: issue.createdAt,
            reporterName: issue.reporter.name,
            departmentName: assignment?.department.name ?? null,
            assigneeName: assignment?.assignee?.name ?? null,
            deletedAt: issue.deletedAt,
          };
        }),
      };
    },
    async inspect(id): Promise<AdminIssueInspection | null> {
      const issue = await prisma.issue.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          status: true,
          createdAt: true,
          deletedAt: true,
          category: { select: { name: true } },
          reporter: { select: { name: true } },
          location: {
            select: { description: true, locality: true, city: true, postalCode: true },
          },
          assignments: {
            where: { endedAt: null },
            take: 1,
            select: {
              department: { select: { name: true } },
              assignee: { select: { name: true } },
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
          statusHistory: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true },
          },
          images: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true },
          },
        },
      });
      if (!issue) return null;
      const assignment = issue.assignments[0] ?? null;
      return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        categoryName: issue.category.name,
        severity: issue.severity,
        status: issue.status,
        createdAt: issue.createdAt,
        reporterName: issue.reporter.name,
        departmentName: assignment?.department.name ?? null,
        assigneeName: assignment?.assignee?.name ?? null,
        deletedAt: issue.deletedAt,
        location: issue.location,
        comments: issue.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          authorName: comment.author.name,
        })),
        history: issue.statusHistory,
        images: issue.images,
      };
    },
  };
}

export async function loadAdminIssueBrowser(query: string, page: unknown): Promise<AdminIssueListResult> {
  return browseAdminIssues(await adminAccess(), query, page, createAdminIssueReadStore());
}

export async function loadAdminIssueInspection(id: string) {
  return inspectAdminIssue(await adminAccess(), id, createAdminIssueReadStore());
}
