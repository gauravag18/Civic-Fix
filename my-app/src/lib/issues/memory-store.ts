import { randomUUID } from "node:crypto";
import type { IssueStatus as IssueStatusValue, NotificationType } from "@/generated/prisma/enums";
import type { PersistImage } from "@/lib/issues/image-rules";
import { persistReport, type ReportDatabase, type ReportTx } from "@/lib/issues/persist-report";
import type { IssueStore } from "@/lib/issues/store";
import {
  PUBLIC_PAGE_SIZE,
  type IssueDetail,
  type IssueSummary,
  type PublicIssueCard,
  type PublicListFilters,
  type SeverityValue,
  type StatusHistoryEntry,
} from "@/lib/issues/types";
import type { DepartmentStore } from "@/lib/issues/staff-service";
import type { StaffDatabase, StaffTx } from "@/lib/issues/staff-write";

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
  updatedAt: Date;
  deletedAt: Date | null;
  publishedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
};

type StoredHistory = StatusHistoryEntry & { issueId: string };

type StoredAudit = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, string | null>;
  ipAddress: string | null;
  createdAt: Date;
};

type StoredAssignment = {
  id: string;
  issueId: string;
  departmentId: string;
  assigneeId: string | null;
  assignedById: string;
  assignedAt: Date;
  endedAt: Date | null;
  note: string | null;
};

type StoredComment = {
  id: string;
  issueId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
};

type StoredImage = PersistImage & {
  id: string;
  issueId: string;
  uploadedById: string;
  createdAt: Date;
  deletedAt: Date | null;
};

type StoredNotification = {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  issueId: string | null;
  commentId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

type StoredMember = {
  userId: string;
  departmentId: string;
  name: string;
  eligible: boolean;
};

type StoredTransition = {
  fromStatus: IssueStatusValue;
  toStatus: IssueStatusValue;
};

function sameText(left: string, right: string): boolean {
  return left.localeCompare(right, "en", { sensitivity: "accent" }) === 0;
}

export class MemoryIssueStore implements IssueStore, DepartmentStore {
  readonly categories: StoredCategory[] = [];
  readonly locations: StoredLocation[] = [];
  readonly issues: StoredIssue[] = [];
  readonly history: StoredHistory[] = [];
  readonly audits: StoredAudit[] = [];
  readonly assignments: StoredAssignment[] = [];
  readonly comments: StoredComment[] = [];
  readonly images: StoredImage[] = [];
  readonly notifications: StoredNotification[] = [];
  readonly roster: StoredMember[] = [];
  readonly transitions: StoredTransition[] = [];
  reads = 0;
  publicReads = 0;
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
      comments: this.comments
        .filter((row) => row.issueId === issue.id && row.deletedAt === null)
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
        )
        .map((row) => ({
          id: row.id,
          body: row.body,
          createdAt: row.createdAt,
          authorName: row.authorName,
        })),
      images: this.images
        .filter((row) => row.issueId === issue.id && row.deletedAt === null)
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
        )
        .map((row) => ({ id: row.id })),
    };
  }

  async listPublic(filters: PublicListFilters, page: number, pageSize: number) {
    this.publicReads += 1;
    const size = Math.min(PUBLIC_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
    const safePage = Math.min(1000, Math.max(1, Math.floor(page)));
    const needle = filters.q.toLocaleLowerCase("en");
    const rows = this.issues
      .filter((issue) => issue.publishedAt !== null && issue.deletedAt === null)
      .filter((issue) => (filters.categoryId ? issue.categoryId === filters.categoryId : true))
      .filter((issue) => (filters.status ? issue.status === filters.status : true))
      .filter((issue) => (needle ? issue.title.toLocaleLowerCase("en").includes(needle) : true))
      .sort((left, right) => {
        const leftTime = filters.sort === "updated" ? left.updatedAt.getTime() : left.createdAt.getTime();
        const rightTime = filters.sort === "updated" ? right.updatedAt.getTime() : right.createdAt.getTime();
        return rightTime - leftTime || right.id.localeCompare(left.id);
      });
    const cards = rows.flatMap((issue) => {
      const card = this.publicCard(issue);
      return card ? [card] : [];
    });
    const start = (safePage - 1) * size;
    return {
      ok: true as const,
      total: cards.length,
      items: cards.slice(start, start + size),
    };
  }

  async getPublic(issueId: string) {
    this.publicReads += 1;
    const issue = this.issues.find(
      (row) => row.id === issueId && row.publishedAt !== null && row.deletedAt === null,
    );
    return { ok: true as const, issue: issue ? this.publicCard(issue) : null };
  }

  async getOwnedPublication(reporterId: string, issueId: string) {
    const issue = this.issues.find(
      (row) => row.id === issueId && row.reporterId === reporterId && row.deletedAt === null,
    );
    if (!issue) return { ok: false as const, reason: "missing" as const };
    return { ok: true as const, publishedAt: issue.publishedAt };
  }

  async setOwnedPublication(input: {
    reporterId: string;
    issueId: string;
    publish: boolean;
    now: Date;
    ipAddress: string | null;
  }) {
    const issue = this.issues.find(
      (row) => row.id === input.issueId && row.reporterId === input.reporterId && row.deletedAt === null,
    );
    if (!issue) return { ok: false as const, reason: "missing" as const };
    issue.publishedAt = input.publish ? input.now : null;
    issue.updatedAt = input.now;
    this.audits.push({
      actorId: input.reporterId,
      action: input.publish ? "issue.published" : "issue.unpublished",
      entityType: "Issue",
      entityId: input.issueId,
      metadata: {},
      ipAddress: input.ipAddress,
      createdAt: input.now,
    });
    return { ok: true as const, publishedAt: issue.publishedAt };
  }

  private publicCard(issue: StoredIssue): PublicIssueCard | null {
    const category = this.categories.find((row) => row.id === issue.categoryId);
    const location = this.locations.find((row) => row.id === issue.locationId);
    if (!category || !location) return null;
    return {
      id: issue.id,
      title: issue.title,
      categoryName: category.name,
      locality: location.locality,
      city: location.city,
      status: issue.status,
      createdAt: issue.createdAt,
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

  async listQueue(departmentId: string, kind: "assigned" | "unassigned", page: number, pageSize: number) {
    const rows = this.issues
      .filter((issue) => issue.deletedAt === null && this.inQueue(issue, departmentId, kind))
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

  async visibleIssue(departmentId: string, issueId: string) {
    const issue = this.issues.find((row) => row.id === issueId && row.deletedAt === null);
    if (!issue || !this.canView(issue, departmentId)) return null;
    const detail = await this.getForReporter(issue.reporterId, issue.id);
    if (!detail) return null;
    const active = this.activeAssignment(issue.id);
    const assignee = active?.assigneeId
      ? this.roster.find(
          (member) => member.userId === active.assigneeId && member.departmentId === departmentId,
        )
      : undefined;
    return {
      ...detail,
      assignment: active
        ? {
            assigneeId: active.assigneeId,
            assigneeName: assignee?.name ?? null,
            note: active.note,
          }
        : null,
    };
  }

  async members(departmentId: string) {
    return this.roster
      .filter((member) => member.departmentId === departmentId && member.eligible)
      .map((member) => ({ id: member.userId, name: member.name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async transitionsFrom(status: IssueStatusValue) {
    return this.transitions
      .filter((transition) => transition.fromStatus === status)
      .map((transition) => transition.toStatus);
  }

  staffDb(): StaffDatabase {
    return this.staffDatabase();
  }

  private inQueue(
    issue: StoredIssue,
    departmentId: string,
    kind: "assigned" | "unassigned",
  ): boolean {
    const active = this.activeAssignment(issue.id);
    if (kind === "assigned") return active?.departmentId === departmentId;
    return active === null && this.transitions.some(
      (transition) => transition.fromStatus === issue.status && transition.toStatus === "ASSIGNED",
    );
  }

  private canView(issue: StoredIssue, departmentId: string): boolean {
    const active = this.activeAssignment(issue.id);
    if (active) return active.departmentId === departmentId;
    return this.transitions.some(
      (transition) => transition.fromStatus === issue.status && transition.toStatus === "ASSIGNED",
    );
  }

  private activeAssignment(issueId: string): StoredAssignment | null {
    return this.assignments.find((row) => row.issueId === issueId && row.endedAt === null) ?? null;
  }

  private staffDatabase(): StaffDatabase {
    return {
      $transaction: (work) => {
        const snapshot = this.staffSnapshot();
        return work(this.staffTransaction()).catch((error: unknown) => {
          this.restoreStaff(snapshot);
          throw error;
        });
      },
    };
  }

  private staffTransaction(): StaffTx {
    return {
      issue: async (id) => {
        const issue = this.issues.find((row) => row.id === id);
        if (!issue) return null;
        return {
          id: issue.id,
          reporterId: issue.reporterId,
          title: issue.title,
          status: issue.status,
          deletedAt: issue.deletedAt,
          createdAt: issue.createdAt,
          resolvedAt: issue.resolvedAt,
          closedAt: issue.closedAt,
        };
      },
      activeAssignment: async (issueId) => this.activeAssignment(issueId),
      allows: async (fromStatus, toStatus) =>
        this.transitions.some(
          (transition) => transition.fromStatus === fromStatus && transition.toStatus === toStatus,
        ),
      isMember: async (userId, departmentId) =>
        this.roster.some(
          (member) =>
            member.userId === userId && member.departmentId === departmentId && member.eligible,
        ),
      endAssignment: async (id, endedAt) => {
        const assignment = this.assignments.find((row) => row.id === id);
        if (assignment) assignment.endedAt = endedAt;
      },
      createAssignment: async (input) => {
        this.assignments.push({ ...input, id: randomUUID(), endedAt: null });
      },
      updateAssignmentNote: async (id, note) => {
        const assignment = this.assignments.find((row) => row.id === id);
        if (assignment) assignment.note = note;
      },
      updateStatus: async (input) => {
        const issue = this.issues.find((row) => row.id === input.issueId);
        if (!issue) return;
        issue.status = input.status;
        issue.resolvedAt = input.resolvedAt;
        issue.closedAt = input.closedAt;
      },
      addHistory: async (input) => {
        this.history.push({ ...input, id: randomUUID() });
      },
      addComment: async (input) => {
        const id = randomUUID();
        const author = this.roster.find((member) => member.userId === input.authorId);
        this.comments.push({
          ...input,
          id,
          authorName: author?.name ?? "Department staff",
          deletedAt: null,
        });
        return { id };
      },
      addAudit: async (input) => {
        if (this.failAt === "audit") throw new Error("audit failed");
        this.audits.push(input);
      },
      addNotification: async (input) => {
        this.notifications.push({ ...input, id: randomUUID(), readAt: null });
      },
    };
  }

  private staffSnapshot() {
    return {
      issues: this.issues.map((row) => ({ ...row })),
      history: this.history.map((row) => ({ ...row })),
      audits: this.audits.map((row) => ({ ...row })),
      assignments: this.assignments.map((row) => ({ ...row })),
      comments: this.comments.map((row) => ({ ...row })),
      notifications: this.notifications.map((row) => ({ ...row })),
    };
  }

  private restoreStaff(snapshot: ReturnType<MemoryIssueStore["staffSnapshot"]>) {
    this.issues.splice(0, this.issues.length, ...snapshot.issues);
    this.history.splice(0, this.history.length, ...snapshot.history);
    this.audits.splice(0, this.audits.length, ...snapshot.audits);
    this.assignments.splice(0, this.assignments.length, ...snapshot.assignments);
    this.comments.splice(0, this.comments.length, ...snapshot.comments);
    this.notifications.splice(0, this.notifications.length, ...snapshot.notifications);
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
          this.issues.push({
            ...data,
            id,
            updatedAt: data.createdAt,
            deletedAt: null,
            publishedAt: null,
            resolvedAt: null,
            closedAt: null,
          });
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
      issueImage: {
        create: async ({ data }) => {
          this.images.push({ ...data, id: randomUUID(), deletedAt: null });
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
      images: this.images.map((row) => ({ ...row })),
    };
  }

  private restore(snapshot: ReturnType<MemoryIssueStore["snapshot"]>) {
    this.locations.splice(0, this.locations.length, ...snapshot.locations);
    this.issues.splice(0, this.issues.length, ...snapshot.issues);
    this.history.splice(0, this.history.length, ...snapshot.history);
    this.audits.splice(0, this.audits.length, ...snapshot.audits);
    this.images.splice(0, this.images.length, ...snapshot.images);
  }
}
