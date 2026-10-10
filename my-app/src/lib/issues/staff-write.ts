import type { IssueStatus, NotificationType } from "@/generated/prisma/enums";
import {
  assignmentNotification,
  commentNotification,
  statusNotification,
} from "@/lib/notifications/copy";

export type StaffIssueRecord = {
  id: string;
  reporterId: string;
  title: string;
  status: IssueStatus;
  deletedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
};

export type StaffAssignmentRecord = {
  id: string;
  issueId: string;
  departmentId: string;
  assigneeId: string | null;
  assignedById: string;
  note: string | null;
  endedAt: Date | null;
};

export type StaffOpResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "transition" | "reason" | "assignee" };

export type StaffTx = {
  issue(id: string): Promise<StaffIssueRecord | null>;
  activeAssignment(issueId: string): Promise<StaffAssignmentRecord | null>;
  allows(fromStatus: IssueStatus, toStatus: IssueStatus): Promise<boolean>;
  isMember(userId: string, departmentId: string): Promise<boolean>;
  endAssignment(id: string, endedAt: Date): Promise<void>;
  createAssignment(input: {
    issueId: string;
    departmentId: string;
    assigneeId: string | null;
    assignedById: string;
    note: string | null;
    assignedAt: Date;
  }): Promise<void>;
  updateAssignmentNote(id: string, note: string | null): Promise<void>;
  updateStatus(input: {
    issueId: string;
    status: IssueStatus;
    resolvedAt: Date | null;
    closedAt: Date | null;
  }): Promise<void>;
  addHistory(input: {
    issueId: string;
    fromStatus: IssueStatus;
    toStatus: IssueStatus;
    changedById: string;
    reason: string | null;
    createdAt: Date;
  }): Promise<void>;
  addComment(input: {
    issueId: string;
    authorId: string;
    body: string;
    createdAt: Date;
  }): Promise<{ id: string }>;
  addAudit(input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, string | null>;
    ipAddress: string | null;
    createdAt: Date;
  }): Promise<void>;
  addNotification(input: {
    recipientId: string;
    type: NotificationType;
    title: string;
    body: string;
    issueId: string;
    commentId: string | null;
    createdAt: Date;
  }): Promise<void>;
};

export type StaffDatabase = {
  $transaction<T>(work: (tx: StaffTx) => Promise<T>): Promise<T>;
};

const REASON_STATUSES = new Set<IssueStatus>(["REJECTED", "REOPENED"]);

function needsReason(status: IssueStatus): boolean {
  return REASON_STATUSES.has(status);
}

async function notify(
  tx: StaffTx,
  input: {
    recipientId: string;
    actorId: string;
    type: NotificationType;
    title: string;
    body: string;
    issueId: string;
    commentId: string | null;
    createdAt: Date;
  },
): Promise<void> {
  if (input.recipientId === input.actorId) return;
  await tx.addNotification({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body,
    issueId: input.issueId,
    commentId: input.commentId,
    createdAt: input.createdAt,
  });
}

async function ownedDepartment(
  tx: StaffTx,
  issueId: string,
  departmentId: string,
): Promise<{ issue: StaffIssueRecord; assignment: StaffAssignmentRecord } | null> {
  const issue = await tx.issue(issueId);
  if (!issue || issue.deletedAt) return null;
  const assignment = await tx.activeAssignment(issueId);
  if (!assignment || assignment.departmentId !== departmentId) return null;
  return { issue, assignment };
}

export async function writeAssignment(
  db: StaffDatabase,
  input: {
    actorId: string;
    departmentId: string;
    issueId: string;
    assigneeId: string | null;
    note: string | null;
    now: Date;
    ipAddress: string | null;
  },
): Promise<StaffOpResult> {
  return db.$transaction(async (tx) => {
    const issue = await tx.issue(input.issueId);
    if (!issue || issue.deletedAt) return { ok: false, reason: "missing" };
    const active = await tx.activeAssignment(input.issueId);
    if (active && active.departmentId !== input.departmentId) {
      return { ok: false, reason: "missing" };
    }
    if (input.assigneeId && !(await tx.isMember(input.assigneeId, input.departmentId))) {
      return { ok: false, reason: "assignee" };
    }

    const sameAssignee =
      active !== null &&
      active.departmentId === input.departmentId &&
      active.assigneeId === input.assigneeId;
    if (sameAssignee && active.note === input.note) return { ok: true };
    if (sameAssignee) {
      await tx.updateAssignmentNote(active.id, input.note);
      await tx.addAudit({
        actorId: input.actorId,
        action: "issue.assigned",
        entityType: "Issue",
        entityId: issue.id,
        metadata: {
          departmentId: input.departmentId,
          assigneeId: input.assigneeId,
        },
        ipAddress: input.ipAddress,
        createdAt: input.now,
      });
      return { ok: true };
    }

    const claiming = active === null;
    if (claiming && issue.status !== "ASSIGNED") {
      const allowed = await tx.allows(issue.status, "ASSIGNED");
      if (!allowed) return { ok: false, reason: "transition" };
    }

    if (active) await tx.endAssignment(active.id, input.now);
    await tx.createAssignment({
      issueId: issue.id,
      departmentId: input.departmentId,
      assigneeId: input.assigneeId,
      assignedById: input.actorId,
      note: input.note,
      assignedAt: input.now,
    });
    if (claiming && issue.status !== "ASSIGNED") {
      await tx.updateStatus({
        issueId: issue.id,
        status: "ASSIGNED",
        resolvedAt: issue.resolvedAt,
        closedAt: issue.closedAt,
      });
      await tx.addHistory({
        issueId: issue.id,
        fromStatus: issue.status,
        toStatus: "ASSIGNED",
        changedById: input.actorId,
        reason: input.note,
        createdAt: input.now,
      });
    }
    await tx.addAudit({
      actorId: input.actorId,
      action: "issue.assigned",
      entityType: "Issue",
      entityId: issue.id,
      metadata: {
        departmentId: input.departmentId,
        assigneeId: input.assigneeId,
      },
        ipAddress: input.ipAddress,
        createdAt: input.now,
      });
    if (input.assigneeId) {
      const assigned = assignmentNotification();
      await notify(tx, {
        recipientId: input.assigneeId,
        actorId: input.actorId,
        type: assigned.type,
        title: assigned.title,
        body: assigned.body,
        issueId: issue.id,
        commentId: null,
        createdAt: input.now,
      });
    }
    if (claiming && issue.status !== "ASSIGNED") {
      const status = statusNotification("ASSIGNED");
      await notify(tx, {
        recipientId: issue.reporterId,
        actorId: input.actorId,
        type: status.type,
        title: status.title,
        body: status.body,
        issueId: issue.id,
        commentId: null,
        createdAt: input.now,
      });
    }
    return { ok: true };
  });
}

export async function writeStatusChange(
  db: StaffDatabase,
  input: {
    actorId: string;
    departmentId: string;
    issueId: string;
    toStatus: IssueStatus;
    reason: string | null;
    now: Date;
    ipAddress: string | null;
  },
): Promise<StaffOpResult> {
  return db.$transaction(async (tx) => {
    const owned = await ownedDepartment(tx, input.issueId, input.departmentId);
    if (!owned) return { ok: false, reason: "missing" };
    if (owned.issue.status === input.toStatus) return { ok: false, reason: "transition" };
    if (!(await tx.allows(owned.issue.status, input.toStatus))) {
      return { ok: false, reason: "transition" };
    }
    if (needsReason(input.toStatus) && !input.reason) return { ok: false, reason: "reason" };

    await tx.updateStatus({
      issueId: owned.issue.id,
      status: input.toStatus,
      resolvedAt:
        input.toStatus === "RESOLVED"
          ? (owned.issue.resolvedAt ?? input.now)
          : owned.issue.resolvedAt,
      closedAt:
        input.toStatus === "CLOSED" ? (owned.issue.closedAt ?? input.now) : owned.issue.closedAt,
    });
    await tx.addHistory({
      issueId: owned.issue.id,
      fromStatus: owned.issue.status,
      toStatus: input.toStatus,
      changedById: input.actorId,
      reason: input.reason,
      createdAt: input.now,
    });
    await tx.addAudit({
      actorId: input.actorId,
      action: "issue.status",
      entityType: "Issue",
      entityId: owned.issue.id,
      metadata: { fromStatus: owned.issue.status, toStatus: input.toStatus },
      ipAddress: input.ipAddress,
      createdAt: input.now,
    });
    const notice = statusNotification(input.toStatus);
    await notify(tx, {
      recipientId: owned.issue.reporterId,
      actorId: input.actorId,
      type: notice.type,
      title: notice.title,
      body: notice.body,
      issueId: owned.issue.id,
      commentId: null,
      createdAt: input.now,
    });
    return { ok: true };
  });
}

export async function writeComment(
  db: StaffDatabase,
  input: {
    actorId: string;
    departmentId: string;
    issueId: string;
    body: string;
    now: Date;
    ipAddress: string | null;
  },
): Promise<StaffOpResult> {
  return db.$transaction(async (tx) => {
    const owned = await ownedDepartment(tx, input.issueId, input.departmentId);
    if (!owned) return { ok: false, reason: "missing" };
    const comment = await tx.addComment({
      issueId: owned.issue.id,
      authorId: input.actorId,
      body: input.body,
      createdAt: input.now,
    });
    await tx.addAudit({
      actorId: input.actorId,
      action: "issue.comment",
      entityType: "IssueComment",
      entityId: comment.id,
      metadata: { issueId: owned.issue.id },
      ipAddress: input.ipAddress,
      createdAt: input.now,
    });
    const notice = commentNotification();
    await notify(tx, {
      recipientId: owned.issue.reporterId,
      actorId: input.actorId,
      type: notice.type,
      title: notice.title,
      body: notice.body,
      issueId: owned.issue.id,
      commentId: comment.id,
      createdAt: input.now,
    });
    return { ok: true };
  });
}
