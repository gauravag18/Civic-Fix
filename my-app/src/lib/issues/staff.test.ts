import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import { MemoryIssueStore } from "@/lib/issues/memory-store";
import {
  STAFF_ASSIGNEE,
  STAFF_COMMENT,
  STAFF_FORBIDDEN,
  STAFF_NOT_AVAILABLE,
  STAFF_REASON,
  STAFF_SAVE_FAILED,
  STAFF_SIGN_IN,
  STAFF_TRANSITION,
} from "@/lib/issues/messages";
import { createCitizenIssue, getCitizenIssue } from "@/lib/issues/service";
import {
  assignDepartmentIssue,
  changeDepartmentStatus,
  claimDepartmentUpdate,
  commentOnDepartmentIssue,
  getDepartmentIssue,
  listDepartmentQueue,
  type DepartmentAccess,
} from "@/lib/issues/staff-service";
import { TRANSITION_SEEDS } from "@/lib/issues/transition-seeds";
import type { RawIssueFields } from "@/lib/issues/validate";

const now = new Date("2026-10-09T12:00:00.000Z");
const later = new Date("2026-10-09T13:00:00.000Z");
const categoryId = "11111111-1111-4111-8111-111111111111";
const citizenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherCitizenId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const staffId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherStaffId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const colleagueId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const outsiderId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const departmentA = "33333333-3333-4333-8333-333333333333";
const departmentB = "44444444-4444-4444-8444-444444444444";

const draft: RawIssueFields = {
  title: "Broken footpath",
  description: "The footpath outside the library has a deep crack.",
  categoryId,
  severity: "MEDIUM",
  locationDescription: "12 Library Road",
  city: "Pune",
  locality: "",
  postalCode: "",
  latitude: "",
  longitude: "",
};

function staff(userId: string, departmentId: string): DepartmentAccess {
  return {
    userId,
    departmentId,
    capabilities: capabilitiesFor(["DEPARTMENT_STAFF"], departmentId),
  };
}

function citizenAccess(userId: string): DepartmentAccess {
  return {
    userId,
    departmentId: null,
    capabilities: capabilitiesFor(["CITIZEN"], null),
  };
}

function preparedStore() {
  const store = new MemoryIssueStore();
  store.categories.push({
    id: categoryId,
    code: "ROADS",
    name: "Roads and pavements",
    isActive: true,
    sortOrder: 10,
  });
  store.transitions.push(...TRANSITION_SEEDS);
  store.roster.push(
    { userId: staffId, departmentId: departmentA, name: "Asha Rao", eligible: true },
    { userId: colleagueId, departmentId: departmentA, name: "Dev Shah", eligible: true },
    { userId: otherStaffId, departmentId: departmentB, name: "Mina Das", eligible: true },
    { userId: outsiderId, departmentId: departmentB, name: "Outsider", eligible: false },
  );
  return store;
}

async function reportedIssue(store: MemoryIssueStore) {
  const created = await createCitizenIssue(
    { userId: citizenId, capabilities: capabilitiesFor(["CITIZEN"], null) },
    draft,
    store,
    now,
    null,
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("fixture");
  return created.issueId;
}

describe("department staff workflow", () => {
  it("rejects staff actions without a department membership", async () => {
    const store = preparedStore();
    const issueId = await reportedIssue(store);
    const denied = await Promise.all([
      assignDepartmentIssue(null, { issueId, assigneeId: "", note: "" }, store, later, null),
      changeDepartmentStatus(
        citizenAccess(citizenId),
        { issueId, toStatus: "ASSIGNED", reason: "" },
        store,
        later,
        null,
      ),
      commentOnDepartmentIssue(null, { issueId, body: "Noted." }, store, later, null),
    ]);
    assert.equal(denied[0].ok, false);
    if (!denied[0].ok) assert.equal(denied[0].message, STAFF_SIGN_IN);
    assert.equal(denied[1].ok, false);
    if (!denied[1].ok) assert.equal(denied[1].message, STAFF_FORBIDDEN);
    assert.equal(denied[2].ok, false);
    assert.equal(store.assignments.length, 0);
    assert.equal(store.issues[0]?.status, "REPORTED");
  });

  it("assigns only the staff member's own department and records history", async () => {
    const store = preparedStore();
    const issueId = await reportedIssue(store);
    const unassigned = await listDepartmentQueue(staff(staffId, departmentA), "unassigned", 1, store);
    const assigned = await assignDepartmentIssue(
      staff(staffId, departmentA),
      {
        issueId,
        assigneeId: colleagueId,
        note: "Taken by roads",
        departmentId: departmentB,
      } as { issueId: string; assigneeId: string; note: string },
      store,
      later,
      "203.0.113.20",
    );
    const otherQueue = await listDepartmentQueue(staff(otherStaffId, departmentB), "assigned", 1, store);
    const hidden = await getDepartmentIssue(staff(otherStaffId, departmentB), issueId, store);

    assert.equal(unassigned.ok && unassigned.total, 1);
    assert.equal(assigned.ok, true);
    assert.equal(store.assignments.length, 1);
    assert.equal(store.assignments[0]?.departmentId, departmentA);
    assert.equal(store.assignments[0]?.assigneeId, colleagueId);
    assert.equal(store.assignments[0]?.assignedById, staffId);
    assert.equal(store.issues[0]?.reporterId, citizenId);
    assert.equal(store.issues[0]?.status, "ASSIGNED");
    assert.equal(store.history.at(-1)?.fromStatus, "REPORTED");
    assert.equal(store.history.at(-1)?.toStatus, "ASSIGNED");
    assert.equal(store.audits.at(-1)?.action, "issue.assigned");
    assert.equal(store.audits.at(-1)?.ipAddress, "203.0.113.20");
    assert.equal(otherQueue.ok && otherQueue.total, 0);
    assert.deepEqual(hidden, { ok: false, reason: "missing" });
  });

  it("rejects an assignee from another department and an illegal status jump", async () => {
    const store = preparedStore();
    const issueId = await reportedIssue(store);
    const outsider = await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, assigneeId: otherStaffId, note: "" },
      store,
      later,
      null,
    );
    assert.equal(outsider.ok, false);
    if (!outsider.ok) assert.equal(outsider.message, STAFF_ASSIGNEE);
    assert.equal(store.assignments.length, 0);

    await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, assigneeId: "", note: "" },
      store,
      later,
      null,
    );
    const jump = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId, toStatus: "CLOSED", reason: "" },
      store,
      later,
      null,
    );
    const other = await changeDepartmentStatus(
      staff(otherStaffId, departmentB),
      { issueId, toStatus: "IN_PROGRESS", reason: "" },
      store,
      later,
      null,
    );
    assert.equal(jump.ok, false);
    if (!jump.ok) assert.equal(jump.message, STAFF_TRANSITION);
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.message, STAFF_NOT_AVAILABLE);
    assert.equal(store.issues[0]?.status, "ASSIGNED");
  });

  it("requires a reason for reopening and shows the update to the reporter", async () => {
    const store = preparedStore();
    const issueId = await reportedIssue(store);
    await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, assigneeId: staffId, note: "" },
      store,
      later,
      null,
    );
    await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId, toStatus: "IN_PROGRESS", reason: "" },
      store,
      new Date(later.getTime() + 1000),
      null,
    );
    const resolved = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId, toStatus: "RESOLVED", reason: "The slab was replaced." },
      store,
      new Date(later.getTime() + 2000),
      null,
    );
    store.transitions.push({ fromStatus: "RESOLVED", toStatus: "REOPENED" });
    const missingReason = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId, toStatus: "REOPENED", reason: " " },
      store,
      new Date(later.getTime() + 3000),
      null,
    );
    const reopened = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId, toStatus: "REOPENED", reason: "The crack came back." },
      store,
      new Date(later.getTime() + 4000),
      null,
    );
    const comment = await commentOnDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, body: "We will inspect it again." },
      store,
      new Date(later.getTime() + 5000),
      null,
    );
    const outsiderComment = await commentOnDepartmentIssue(
      staff(otherStaffId, departmentB),
      { issueId, body: "This is not our report." },
      store,
      new Date(later.getTime() + 6000),
      null,
    );
    const own = await getCitizenIssue(
      { userId: citizenId, capabilities: capabilitiesFor(["CITIZEN"], null) },
      issueId,
      store,
    );
    const stranger = await getCitizenIssue(
      { userId: otherCitizenId, capabilities: capabilitiesFor(["CITIZEN"], null) },
      issueId,
      store,
    );

    assert.equal(resolved.ok, true);
    assert.equal(store.issues[0]?.resolvedAt?.toISOString(), new Date(later.getTime() + 2000).toISOString());
    assert.equal(missingReason.ok, false);
    if (!missingReason.ok) assert.equal(missingReason.message, STAFF_REASON);
    assert.equal(reopened.ok, true);
    assert.equal(comment.ok, true);
    assert.equal(outsiderComment.ok, false);
    if (!outsiderComment.ok) assert.equal(outsiderComment.message, STAFF_NOT_AVAILABLE);
    assert.equal(own.ok, true);
    if (own.ok) {
      assert.equal(own.issue.status, "REOPENED");
      assert.equal(own.issue.comments.length, 1);
      assert.equal(own.issue.comments[0]?.body, "We will inspect it again.");
      assert.equal(own.issue.comments[0]?.authorName, "Asha Rao");
      assert.equal(own.issue.history.some((entry) => entry.toStatus === "RESOLVED"), true);
    }
    assert.deepEqual(stranger, { ok: false, reason: "missing" });
    assert.equal(store.comments.length, 1);
  });

  it("rolls back a status change when the audit write fails", async () => {
    const store = preparedStore();
    const issueId = await reportedIssue(store);
    await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, assigneeId: "", note: "" },
      store,
      later,
      null,
    );
    const historyBefore = store.history.length;
    store.failAt = "audit";
    const result = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId, toStatus: "IN_PROGRESS", reason: "" },
      store,
      new Date(later.getTime() + 1000),
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, STAFF_SAVE_FAILED);
      assert.equal(result.message.includes("audit"), false);
    }
    assert.equal(store.issues[0]?.status, "ASSIGNED");
    assert.equal(store.history.length, historyBefore);
  });

  it("rejects an empty comment and limits repeated department updates", async () => {
    const store = preparedStore();
    const issueId = await reportedIssue(store);
    await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, assigneeId: "", note: "" },
      store,
      later,
      null,
    );
    const empty = await commentOnDepartmentIssue(
      staff(staffId, departmentA),
      { issueId, body: " " },
      store,
      later,
      null,
    );
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.message, STAFF_COMMENT);
    assert.equal(store.comments.length, 0);

    const limiter = new SlidingWindowLimiter(20, 60_000);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal(claimDepartmentUpdate(limiter, staffId, 1_000 + attempt), true);
    }
    assert.equal(claimDepartmentUpdate(limiter, staffId, 1_020), false);
  });

  it("opens the department queue for provisioned staff before they change the initial password", async () => {
    const access = staff(staffId, departmentA);
    assert.ok(access);
    const result = await listDepartmentQueue(
      { userId: access.userId, departmentId: access.departmentId, capabilities: access.capabilities, mustChangePassword: true },
      "assigned",
      "1",
      preparedStore(),
    );
    assert.equal(result.ok, true);
    const missingMembership = await listDepartmentQueue(
      { userId: access.userId, departmentId: null, capabilities: access.capabilities, mustChangePassword: false },
      "assigned",
      "1",
      preparedStore(),
    );
    assert.equal(missingMembership.ok, false);
    if (!missingMembership.ok) assert.equal(missingMembership.reason, "forbidden");
  });
});
