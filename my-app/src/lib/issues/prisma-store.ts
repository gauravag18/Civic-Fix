import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { persistReport, type ReportDatabase } from "@/lib/issues/persist-report";
import type { IssueStore } from "@/lib/issues/store";
import type { IssueDetail, IssueSummary } from "@/lib/issues/types";

function decimalText(value: { toString(): string } | string | null): string | null {
  if (value === null) return null;
  return value.toString();
}

export function createPrismaIssueStore(): IssueStore {
  const prisma = getPrismaClient();

  return {
    async createReport(input) {
      try {
        return await persistReport(prisma as unknown as ReportDatabase, input);
      } catch {
        console.error("Issue creation failed.");
        return { ok: false, reason: "unavailable" };
      }
    },

    async listActiveCategories() {
      const rows = await prisma.issueCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      });
      return rows;
    },

    async listForReporter(reporterId, page, pageSize) {
      const where = { reporterId, deletedAt: null };
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

    async getForReporter(reporterId, issueId): Promise<IssueDetail | null> {
      const issue = await prisma.issue.findFirst({
        where: { id: issueId, reporterId, deletedAt: null },
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
        },
      });
      if (!issue) return null;
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
      };
    },
  };
}
