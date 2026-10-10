import { Capability, hasCapability } from "@/lib/auth/capabilities";
import { rateKey, type SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import { IssueStatus, type IssueStatus as IssueStatusValue } from "@/generated/prisma/enums";
import {
  STAFF_ASSIGNEE,
  STAFF_COMMENT,
  STAFF_FORBIDDEN,
  STAFF_NOT_AVAILABLE,
  STAFF_PASSWORD,
  STAFF_REASON,
  STAFF_SAVE_FAILED,
  STAFF_SIGN_IN,
  STAFF_TRANSITION,
} from "@/lib/issues/messages";
import {
  writeAssignment,
  writeComment,
  writeStatusChange,
  type StaffDatabase,
  type StaffOpResult,
} from "@/lib/issues/staff-write";
import { ISSUE_PAGE_SIZE, type DepartmentIssue, type IssueSummary } from "@/lib/issues/types";
import { isUuid } from "@/lib/issues/validate";
import { pageNumber } from "@/lib/issues/service";

export type DepartmentAccess = {
  userId: string;
  departmentId: string | null;
  capabilities: ReadonlySet<string>;
  mustChangePassword?: boolean;
} | null;

export type QueueKind = "assigned" | "unassigned";

export type DepartmentStore = {
  listQueue(
    departmentId: string,
    kind: QueueKind,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: IssueSummary[] }>;
  visibleIssue(departmentId: string, issueId: string): Promise<DepartmentIssue | null>;
  members(departmentId: string): Promise<{ id: string; name: string }[]>;
  transitionsFrom(status: IssueStatusValue): Promise<IssueStatusValue[]>;
  staffDb(): StaffDatabase;
};

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function claimDepartmentUpdate(
  limiter: SlidingWindowLimiter,
  userId: string,
  nowMs: number,
): boolean {
  return limiter.allow(rateKey(["department.update", userId]), nowMs);
}

export function requireStaff(
  access: DepartmentAccess,
): { ok: true; userId: string; departmentId: string } | { ok: false; reason: "signed-out" | "forbidden" | "password" } {
  if (!access) return { ok: false, reason: "signed-out" };
  if (access.mustChangePassword) return { ok: false, reason: "password" };
  if (!access.departmentId || !hasCapability(access.capabilities, Capability.departmentWork)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, userId: access.userId, departmentId: access.departmentId };
}

function accessMessage(reason: "signed-out" | "forbidden" | "password"): string {
  if (reason === "signed-out") return STAFF_SIGN_IN;
  if (reason === "password") return STAFF_PASSWORD;
  return STAFF_FORBIDDEN;
}

function cleanOptional(value: string, max: number): string | null | "invalid" {
  const text = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (CONTROL.test(value) || text.length > max) return "invalid";
  return text || null;
}

function cleanComment(value: string): string | null {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (CONTROL.test(value) || text.length < 1 || text.length > 2000) return null;
  return text;
}

function isStatus(value: string): value is IssueStatusValue {
  return (Object.values(IssueStatus) as string[]).includes(value);
}

async function runWrite(
  store: DepartmentStore,
  work: (db: StaffDatabase) => Promise<StaffOpResult>,
): Promise<StaffOpResult | { ok: false; reason: "unavailable" }> {
  try {
    return await work(store.staffDb());
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function failureMessage(
  reason: "missing" | "transition" | "reason" | "assignee" | "unavailable",
): string {
  if (reason === "transition") return STAFF_TRANSITION;
  if (reason === "reason") return STAFF_REASON;
  if (reason === "assignee") return STAFF_ASSIGNEE;
  if (reason === "missing") return STAFF_NOT_AVAILABLE;
  return STAFF_SAVE_FAILED;
}

export async function listDepartmentQueue(
  access: DepartmentAccess,
  kind: QueueKind,
  requestedPage: unknown,
  store: DepartmentStore,
): Promise<
  | { ok: true; page: number; pageSize: number; total: number; items: IssueSummary[] }
  | { ok: false; reason: "signed-out" | "forbidden" | "password" | "unavailable" }
> {
  const staff = requireStaff(access);
  if (!staff.ok) return staff;
  try {
    const pageSize = ISSUE_PAGE_SIZE;
    const requested = pageNumber(requestedPage);
    const first = await store.listQueue(staff.departmentId, kind, requested, pageSize);
    const lastPage = Math.max(1, Math.ceil(first.total / pageSize));
    if (requested > lastPage) {
      const last = await store.listQueue(staff.departmentId, kind, lastPage, pageSize);
      return { ok: true, page: lastPage, pageSize, total: last.total, items: last.items };
    }
    return { ok: true, page: requested, pageSize, total: first.total, items: first.items };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function getDepartmentIssue(
  access: DepartmentAccess,
  issueId: string,
  store: DepartmentStore,
): Promise<
  | {
      ok: true;
      issue: DepartmentIssue;
      transitions: IssueStatusValue[];
      members: { id: string; name: string }[];
    }
  | { ok: false; reason: "signed-out" | "forbidden" | "password" | "missing" | "unavailable" }
> {
  const staff = requireStaff(access);
  if (!staff.ok) return staff;
  if (!isUuid(issueId)) return { ok: false, reason: "missing" };
  try {
    const issue = await store.visibleIssue(staff.departmentId, issueId);
    if (!issue) return { ok: false, reason: "missing" };
    const [transitions, members] = await Promise.all([
      store.transitionsFrom(issue.status),
      store.members(staff.departmentId),
    ]);
    return { ok: true, issue, transitions, members };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function assignDepartmentIssue(
  access: DepartmentAccess,
  raw: { issueId: string; assigneeId: string; note: string },
  store: DepartmentStore,
  now: Date,
  ipAddress: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const staff = requireStaff(access);
  if (!staff.ok) {
    return { ok: false, message: accessMessage(staff.reason) };
  }
  if (!isUuid(raw.issueId)) return { ok: false, message: STAFF_TRANSITION };
  const note = cleanOptional(raw.note, 500);
  if (note === "invalid") return { ok: false, message: STAFF_ASSIGNEE };
  const assigneeId = raw.assigneeId.trim();
  if (assigneeId && !isUuid(assigneeId)) return { ok: false, message: STAFF_ASSIGNEE };

  const written = await runWrite(store, (db) =>
    writeAssignment(db, {
      actorId: staff.userId,
      departmentId: staff.departmentId,
      issueId: raw.issueId,
      assigneeId: assigneeId || null,
      note,
      now,
      ipAddress,
    }),
  );
  if (!written.ok) return { ok: false, message: failureMessage(written.reason) };
  return { ok: true };
}

export async function changeDepartmentStatus(
  access: DepartmentAccess,
  raw: { issueId: string; toStatus: string; reason: string },
  store: DepartmentStore,
  now: Date,
  ipAddress: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const staff = requireStaff(access);
  if (!staff.ok) {
    return { ok: false, message: accessMessage(staff.reason) };
  }
  const toStatus = raw.toStatus;
  if (!isUuid(raw.issueId) || !isStatus(toStatus)) {
    return { ok: false, message: STAFF_TRANSITION };
  }
  const reason = cleanOptional(raw.reason, 1000);
  if (reason === "invalid") return { ok: false, message: STAFF_REASON };

  const written = await runWrite(store, (db) =>
    writeStatusChange(db, {
      actorId: staff.userId,
      departmentId: staff.departmentId,
      issueId: raw.issueId,
      toStatus,
      reason,
      now,
      ipAddress,
    }),
  );
  if (!written.ok) return { ok: false, message: failureMessage(written.reason) };
  return { ok: true };
}

export async function commentOnDepartmentIssue(
  access: DepartmentAccess,
  raw: { issueId: string; body: string },
  store: DepartmentStore,
  now: Date,
  ipAddress: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const staff = requireStaff(access);
  if (!staff.ok) {
    return { ok: false, message: accessMessage(staff.reason) };
  }
  if (!isUuid(raw.issueId)) return { ok: false, message: STAFF_COMMENT };
  const body = cleanComment(raw.body);
  if (!body) return { ok: false, message: STAFF_COMMENT };

  const written = await runWrite(store, (db) =>
    writeComment(db, {
      actorId: staff.userId,
      departmentId: staff.departmentId,
      issueId: raw.issueId,
      body,
      now,
      ipAddress,
    }),
  );
  if (!written.ok) return { ok: false, message: failureMessage(written.reason) };
  return { ok: true };
}
