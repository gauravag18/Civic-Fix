import { randomUUID } from "node:crypto";
import type { IssueStatus as IssueStatusValue } from "@/generated/prisma/enums";
import { persistReport, type ReportDatabase, type ReportTx } from "@/lib/issues/persist-report";
import type { IssueStore } from "@/lib/issues/store";
import type {
  IssueDetail,
  IssueSummary,
  SeverityValue,
  StatusHistoryEntry,
} from "@/lib/issues/types";

type StoredCategory = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type StoredLocation = {
  id: string;
  description: string;
  locality: string | null;
  city: string;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
};

type StoredIssue = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  reporterId: string;
  locationId: string;
  severity: SeverityValue;
  status: IssueStatusValue;
  createdAt: Date;
  deletedAt: Date | null;
};

type StoredHistory = StatusHistoryEntry & { issueId: string };

type StoredAudit = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: { categoryCode: string; severity: SeverityValue };
  ipAddress: string | null;
  createdAt: Date;
};

function sameText(left: string, right: string): boolean {
  return left.localeCompare(right, "en", { sensitivity: "accent" }) === 0;
}

export class MemoryIssueStore implements IssueStore {
  readonly categories: StoredCategory[] = [];
  readonly locations: StoredLocation[] = [];
  readonly issues: StoredIssue[] = [];
  readonly history: StoredHistory[] = [];
  readonly audits: StoredAudit[] = [];
  readonly assignments: unknown[] = [];
  reads = 0;
  failAt: "history" | "audit" | null = null;

  async createReport(input: Parameters<IssueStore["createReport"]>[0]) {
    try {
      return await persistReport(this.database(), input);
    } catch {
      return { ok: false as const, reason: "unavailable" as const };
    }
  }

  async listActiveCategories() {
    return this.categories
      .filter((category) => category.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
      .map((category) => ({ id: category.id, name: category.name }));
  }

  async listForReporter(reporterId: string, page: number, pageSize: number) {
    const rows = this.issues
      .filter((issue) => issue.reporterId === reporterId && issue.deletedAt === null)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
      );
    const start = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(start, start + pageSize).map((issue) => this.summary(issue)),
    };
  }

  async getForReporter(reporterId: string, issueId: string): Promise<IssueDetail | null> {
    this.reads += 1;
    const issue = this.issues.find(
      (row) => row.id === issueId && row.reporterId === reporterId && row.deletedAt === null,
    );
    if (!issue) return null;
    const location = this.locations.find((row) => row.id === issue.locationId);
    const category = this.categories.find((row) => row.id === issue.categoryId);
    if (!location || !category) return null;
    const history = this.history
      .filter((row) => row.issueId === issue.id)
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
      )
      .map((row) => ({
        id: row.id,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedById: row.changedById,
        reason: row.reason,
        createdAt: row.createdAt,
      }));
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      categoryName: category.name,
      severity: issue.severity,
      status: issue.status,
      createdAt: issue.createdAt,
      location: {
        description: location.description,
        locality: location.locality,
        city: location.city,
        postalCode: location.postalCode,
        latitude: location.latitude,
        longitude: location.longitude,
      },
      history,
    };
  }

  private summary(issue: StoredIssue): IssueSummary {
    const category = this.categories.find((row) => row.id === issue.categoryId);
    const location = this.locations.find((row) => row.id === issue.locationId);
    return {
      id: issue.id,
      title: issue.title,
      categoryName: category?.name ?? "Category",
      severity: issue.severity,
      status: issue.status,
      city: location?.city ?? "",
      createdAt: issue.createdAt,
    };
  }

  private database(): ReportDatabase {
    return {
      $transaction: (work) => {
        const snapshot = this.snapshot();
        return work(this.transaction()).catch((error: unknown) => {
          this.restore(snapshot);
          throw error;
        });
      },
    };
  }

  private transaction(): ReportTx {
    return {
      issueCategory: {
        findFirst: async ({ where }) => {
          const category = this.categories.find(
            (row) => row.id === where.id && row.isActive === where.isActive,
          );
          return category
            ? { id: category.id, name: category.name, code: category.code }
            : null;
        },
      },
      issue: {
        findFirst: async ({ where }) => {
          const match = this.issues.find((issue) => {
            if (issue.deletedAt !== null || issue.reporterId !== where.reporterId) return false;
            if (issue.categoryId !== where.categoryId) return false;
            if (issue.createdAt.getTime() < where.createdAt.gte.getTime()) return false;
            if (!sameText(issue.title, where.title.equals)) return false;
            const location = this.locations.find((row) => row.id === issue.locationId);
            return Boolean(
              location && sameText(location.description, where.location.description.equals),
            );
          });
          return match ? { id: match.id } : null;
        },
        create: async ({ data }) => {
          const id = randomUUID();
          this.issues.push({ ...data, id, deletedAt: null });
          return { id };
        },
      },
      location: {
        create: async ({ data }) => {
          const id = randomUUID();
          this.locations.push({ ...data, id });
          return { id };
        },
      },
      issueStatusHistory: {
        create: async ({ data }) => {
          if (this.failAt === "history") throw new Error("history failed");
          this.history.push({ ...data, id: randomUUID(), issueId: data.issueId });
          return undefined;
        },
      },
      auditLog: {
        create: async ({ data }) => {
          if (this.failAt === "audit") throw new Error("audit failed");
          this.audits.push(data);
          return undefined;
        },
      },
    };
  }

  private snapshot() {
    return {
      locations: this.locations.map((row) => ({ ...row })),
      issues: this.issues.map((row) => ({ ...row })),
      history: this.history.map((row) => ({ ...row })),
      audits: this.audits.map((row) => ({ ...row })),
    };
  }

  private restore(snapshot: ReturnType<MemoryIssueStore["snapshot"]>) {
    this.locations.splice(0, this.locations.length, ...snapshot.locations);
    this.issues.splice(0, this.issues.length, ...snapshot.issues);
    this.history.splice(0, this.history.length, ...snapshot.history);
    this.audits.splice(0, this.audits.length, ...snapshot.audits);
  }
}
