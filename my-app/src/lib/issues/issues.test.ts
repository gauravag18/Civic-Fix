import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { MemoryAuthStore } from "@/lib/auth/memory-store";
import { disableAccount, grantRole } from "@/lib/auth/service";
import { SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import { MemoryIssueStore } from "@/lib/issues/memory-store";
import {
  FIELD_CATEGORY,
  FIELD_COORDINATE_PAIR,
  FIELD_LATITUDE,
  ISSUE_CHECK_FIELDS,
  ISSUE_FORBIDDEN,
  ISSUE_SAVE_FAILED,
  ISSUE_SIGN_IN,
} from "@/lib/issues/messages";
import {
  claimIssueSubmission,
  createCitizenIssue,
  getCitizenIssue,
  listCitizenIssues,
} from "@/lib/issues/service";
import type { RawIssueFields } from "@/lib/issues/validate";

const now = new Date("2026-10-09T12:00:00.000Z");
const categoryId = "11111111-1111-4111-8111-111111111111";
const citizenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const valid: RawIssueFields = {
  title: "Broken footpath",
  description: "The footpath outside the library has a deep crack.",
  categoryId,
  severity: "MEDIUM",
  locationDescription: "12 Library Road",
  city: "Pune",
  locality: "Shivajinagar",
  postalCode: "411005",
  latitude: "18.520400",
  longitude: "73.856700",
};

function citizen(userId = citizenId) {
  return { userId, capabilities: capabilitiesFor(["CITIZEN"], null) };
}

function preparedStore(active = true) {
  const store = new MemoryIssueStore();
  store.categories.push({
    id: categoryId,
    code: "ROADS",
    name: "Roads and pavements",
    isActive: active,
    sortOrder: 10,
  });
  return store;
}

describe("citizen issue reporting", () => {
  it("rejects an unauthenticated report and writes nothing", async () => {
    const store = preparedStore();
    const result = await createCitizenIssue(null, valid, store, now, null);

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, ISSUE_SIGN_IN);
    assert.equal(store.issues.length, 0);
    assert.equal(store.locations.length, 0);
    assert.equal(store.history.length, 0);
    assert.equal(store.audits.length, 0);
  });

  it("assigns the reporter from the server access and ignores privileged fields", async () => {
    const store = preparedStore();
    const result = await createCitizenIssue(
      citizen(),
      {
        ...valid,
        status: "RESOLVED",
        reporterId: otherId,
        departmentId: "works",
        assigneeId: "staff",
      } as RawIssueFields,
      store,
      now,
      "203.0.113.10",
    );

    assert.equal(result.ok, true);
    assert.equal(store.issues.length, 1);
    assert.equal(store.issues[0]?.reporterId, citizenId);
    assert.equal(store.issues[0]?.status, "REPORTED");
    assert.equal(store.issues[0]?.severity, "MEDIUM");
    assert.equal(store.locations.length, 1);
    assert.equal(store.history.length, 1);
    assert.equal(store.history[0]?.fromStatus, null);
    assert.equal(store.history[0]?.toStatus, "REPORTED");
    assert.equal(store.history[0]?.changedById, citizenId);
    assert.equal(store.audits.length, 1);
    assert.equal(store.audits[0]?.action, "issue.reported");
    assert.equal(store.audits[0]?.entityId, store.issues[0]?.id);
    assert.equal(store.audits[0]?.ipAddress, "203.0.113.10");
    assert.equal(store.assignments.length, 0);
    assert.equal(result.ok && result.issueId, store.issues[0]?.id);
  });

  it("rejects invalid text, coordinates, and category references", async () => {
    const store = preparedStore();
    const invalid = await createCitizenIssue(
      citizen(),
      { ...valid, title: "Short", latitude: "18.5", longitude: "" },
      store,
      now,
      null,
    );
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.message, ISSUE_CHECK_FIELDS);
      assert.equal(invalid.fieldErrors.title !== undefined, true);
      assert.equal(invalid.fieldErrors.latitude, FIELD_COORDINATE_PAIR);
    }

    const outOfRange = await createCitizenIssue(
      citizen(),
      { ...valid, latitude: "91", longitude: "73.8" },
      store,
      now,
      null,
    );
    assert.equal(outOfRange.ok, false);
    if (!outOfRange.ok) assert.equal(outOfRange.fieldErrors.latitude, FIELD_LATITUDE);

    const badCategory = await createCitizenIssue(
      citizen(),
      { ...valid, categoryId: "not-a-category" },
      store,
      now,
      null,
    );
    assert.equal(badCategory.ok, false);
    if (!badCategory.ok) assert.equal(badCategory.fieldErrors.categoryId, FIELD_CATEGORY);

    const missing = await createCitizenIssue(
      citizen(),
      { ...valid, categoryId: "22222222-2222-4222-8222-222222222222" },
      store,
      now,
      null,
    );
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.fieldErrors.categoryId, FIELD_CATEGORY);

    const inactive = preparedStore(false);
    const hidden = await createCitizenIssue(citizen(), valid, inactive, now, null);
    assert.equal(hidden.ok, false);
    if (!hidden.ok) assert.equal(hidden.fieldErrors.categoryId, FIELD_CATEGORY);
    assert.equal(store.issues.length, 0);
    assert.equal(inactive.issues.length, 0);
  });

  it("rolls back the issue, location, and history when the write fails", async () => {
    const store = preparedStore();
    store.failAt = "audit";
    const result = await createCitizenIssue(citizen(), valid, store, now, null);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, ISSUE_SAVE_FAILED);
      assert.equal(result.message.includes("audit"), false);
    }
    assert.equal(store.issues.length, 0);
    assert.equal(store.locations.length, 0);
    assert.equal(store.history.length, 0);
    assert.equal(store.audits.length, 0);

    store.failAt = "history";
    const historyFailure = await createCitizenIssue(citizen(), valid, store, now, null);
    assert.equal(historyFailure.ok, false);
    assert.equal(store.issues.length, 0);
    assert.equal(store.locations.length, 0);
    assert.equal(store.history.length, 0);
  });

  it("shows a citizen their own report and hides another citizen's report", async () => {
    const store = preparedStore();
    const created = await createCitizenIssue(citizen(), valid, store, now, null);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const own = await getCitizenIssue(citizen(), created.issueId, store);
    const other = await getCitizenIssue(citizen(otherId), created.issueId, store);
    const list = await listCitizenIssues(citizen(otherId), 1, store);
    const unsigned = await getCitizenIssue(null, created.issueId, store);
    const readsBefore = store.reads;
    const malformed = await getCitizenIssue(citizen(), "not-an-id", store);

    assert.equal(own.ok, true);
    if (own.ok) {
      assert.equal(own.issue.title, "Broken footpath");
      assert.equal(own.issue.location.city, "Pune");
      assert.equal(own.issue.history[0]?.toStatus, "REPORTED");
    }
    assert.deepEqual(other, { ok: false, reason: "missing" });
    assert.equal(list.ok && list.total, 0);
    assert.deepEqual(unsigned, { ok: false, reason: "signed-out" });
    assert.deepEqual(malformed, { ok: false, reason: "missing" });
    assert.equal(store.reads, readsBefore);
  });

  it("does not let a citizen grant roles, assign departments, or change status", async () => {
    const issues = preparedStore();
    const created = await createCitizenIssue(
      { userId: citizenId, capabilities: capabilitiesFor(["CITIZEN"], null) },
      { ...valid, status: "ASSIGNED", departmentId: "roads" } as RawIssueFields,
      issues,
      now,
      null,
    );
    assert.equal(created.ok, true);
    assert.equal(issues.issues[0]?.status, "REPORTED");
    assert.equal(issues.assignments.length, 0);

    const auth = new MemoryAuthStore();
    const targetId = randomUUID();
    auth.users.push(
      {
        id: citizenId,
        email: "citizen@example.com",
        name: "Citizen",
        accountStatus: "ACTIVE",
        disabledAt: null,
        emailVerifiedAt: now,
        passwordHash: "hash",
        passwordChangedAt: now,
      },
      {
        id: targetId,
        email: "other@example.com",
        name: "Other",
        accountStatus: "ACTIVE",
        disabledAt: null,
        emailVerifiedAt: now,
        passwordHash: "hash",
        passwordChangedAt: now,
      },
    );
    auth.grants.push({ userId: citizenId, roleCode: "CITIZEN", revokedAt: null });
    assert.equal(
      await grantRole(auth, {
        actorUserId: citizenId,
        targetUserId: targetId,
        roleCode: "DEPARTMENT_STAFF",
        now,
      }),
      "forbidden",
    );
    assert.equal(
      await disableAccount(auth, { actorUserId: citizenId, targetUserId: targetId, now }),
      "forbidden",
    );
    assert.deepEqual(await auth.activeRoleCodes(targetId), []);

    const staff = await createCitizenIssue(
      { userId: otherId, capabilities: capabilitiesFor(["DEPARTMENT_STAFF"], "dept-1") },
      valid,
      issues,
      now,
      null,
    );
    assert.equal(staff.ok, false);
    if (!staff.ok) assert.equal(staff.message, ISSUE_FORBIDDEN);
    assert.equal(issues.issues.length, 1);
  });

  it("reuses a matching report inside the duplicate window", async () => {
    const store = preparedStore();
    const first = await createCitizenIssue(citizen(), valid, store, now, null);
    const second = await createCitizenIssue(
      citizen(),
      { ...valid, title: "broken footpath" },
      store,
      new Date(now.getTime() + 60_000),
      null,
    );
    const later = await createCitizenIssue(
      citizen(),
      valid,
      store,
      new Date(now.getTime() + 10 * 60_000),
      null,
    );

    assert.equal(first.ok && second.ok && first.issueId, second.ok ? second.issueId : "");
    assert.equal(second.ok && second.duplicate, true);
    assert.equal(later.ok && later.duplicate, false);
    assert.equal(store.issues.length, 2);
  });

  it("limits repeated report submissions for one account", () => {
    const limiter = new SlidingWindowLimiter(8, 60_000);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      assert.equal(claimIssueSubmission(limiter, citizenId, 1_000 + attempt), true);
    }
    assert.equal(claimIssueSubmission(limiter, citizenId, 1_008), false);
    assert.equal(claimIssueSubmission(limiter, otherId, 1_008), true);
  });
});
