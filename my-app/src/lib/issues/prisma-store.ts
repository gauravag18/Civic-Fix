import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { persistReport, type ReportDatabase } from "@/lib/issues/persist-report";
import type { IssueStore } from "@/lib/issues/store";
import {
  PUBLIC_PAGE_SIZE,
  type IssueDetail,
  type IssueStatusValue,
  type IssueSummary,
  type PublicListFilters,
} from "@/lib/issues/types";

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
          images: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true },
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
        images: issue.images,
      };
    },

    async listPublic(filters: PublicListFilters, page, pageSize) {
      try {
        const size = Math.min(PUBLIC_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
        const safePage = Math.min(1000, Math.max(1, Math.floor(page)));
        const where = publicWhere(filters);
        const [total, rows] = await Promise.all([
          prisma.issue.count({ where }),
          prisma.issue.findMany({
            where,
            orderBy:
              filters.sort === "updated"
                ? [{ updatedAt: "desc" }, { id: "desc" }]
                : [{ createdAt: "desc" }, { id: "desc" }],
            skip: (safePage - 1) * size,
            take: size,
            select: publicSelect,
          }),
        ]);
        return { ok: true as const, total, items: rows.map(toPublicCard) };
      } catch {
        console.error("Public issue list failed.");
        return { ok: false as const, reason: "unavailable" as const };
      }
    },

    async getPublic(issueId) {
      try {
        const issue = await prisma.issue.findFirst({
          where: { id: issueId, deletedAt: null, publishedAt: { not: null } },
          select: publicSelect,
        });
        return { ok: true as const, issue: issue ? toPublicCard(issue) : null };
      } catch {
        console.error("Public issue lookup failed.");
        return { ok: false as const, reason: "unavailable" as const };
      }
    },

    async getOwnedPublication(reporterId, issueId) {
      try {
        const issue = await prisma.issue.findFirst({
          where: { id: issueId, reporterId, deletedAt: null },
          select: { publishedAt: true },
        });
        if (!issue) return { ok: false as const, reason: "missing" as const };
        return { ok: true as const, publishedAt: issue.publishedAt };
      } catch {
        console.error("Issue publication lookup failed.");
        return { ok: false as const, reason: "unavailable" as const };
      }
    },

    async setOwnedPublication(input) {
      try {
        const publishedAt = await prisma.$transaction(async (tx) => {
          const updated = await tx.issue.updateMany({
            where: { id: input.issueId, reporterId: input.reporterId, deletedAt: null },
            data: { publishedAt: input.publish ? input.now : null },
          });
          if (updated.count !== 1) return undefined;
          await tx.auditLog.create({
            data: {
              actorId: input.reporterId,
              action: input.publish ? "issue.published" : "issue.unpublished",
              entityType: "Issue",
              entityId: input.issueId,
              metadata: {},
              ipAddress: input.ipAddress,
              createdAt: input.now,
            },
          });
          return input.publish ? input.now : null;
        });
        if (publishedAt === undefined) return { ok: false as const, reason: "missing" as const };
        return { ok: true as const, publishedAt };
      } catch {
        console.error("Issue publication failed.");
        return { ok: false as const, reason: "unavailable" as const };
      }
    },
  };
}

const publicSelect = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  category: { select: { name: true } },
  location: { select: { locality: true, city: true } },
} as const;

function publicWhere(filters: PublicListFilters) {
  return {
    deletedAt: null,
    publishedAt: { not: null },
    ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" as const } } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
}

function toPublicCard(issue: {
  id: string;
  title: string;
  status: IssueStatusValue;
  createdAt: Date;
  category: { name: string };
  location: { locality: string | null; city: string };
}) {
  return {
    id: issue.id,
    title: issue.title,
    categoryName: issue.category.name,
    locality: issue.location.locality,
    city: issue.location.city,
    status: issue.status,
    createdAt: issue.createdAt,
  };
}
