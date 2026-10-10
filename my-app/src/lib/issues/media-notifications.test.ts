import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { MemoryIssueStore } from "@/lib/issues/memory-store";
import {
  MAX_ISSUE_IMAGE_BYTES,
  canReadIssueImage,
  validateIssueImages,
} from "@/lib/issues/image-rules";
import { ISSUE_SAVE_FAILED } from "@/lib/issues/messages";
import { createCitizenIssue, getCitizenIssue } from "@/lib/issues/service";
import {
  assignDepartmentIssue,
  changeDepartmentStatus,
  commentOnDepartmentIssue,
  type DepartmentAccess,
} from "@/lib/issues/staff-service";
import { TRANSITION_SEEDS } from "@/lib/issues/transition-seeds";
import type { RawIssueFields } from "@/lib/issues/validate";
import { statusNotification } from "@/lib/notifications/copy";
import { MemoryNotificationStore } from "@/lib/notifications/memory-store";
import {
  listUserNotifications,
  markAllOwnedNotifications,
  markOwnedNotification,
} from "@/lib/notifications/service";

const now = new Date("2026-10-09T12:00:00.000Z");
const later = new Date("2026-10-09T13:00:00.000Z");
const categoryId = "11111111-1111-4111-8111-111111111111";
const citizenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherCitizenId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const staffId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const colleagueId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const otherStaffId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const departmentA = "33333333-3333-4333-8333-333333333333";
const departmentB = "44444444-4444-4444-8444-444444444444";
const noticeId = "55555555-5555-4555-8555-555555555555";

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

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

function citizen(userId: string) {
  return { userId, capabilities: capabilitiesFor(["CITIZEN"], null) };
}

function staff(userId: string, departmentId: string): DepartmentAccess {
  return {
    userId,
    departmentId,
    capabilities: capabilitiesFor(["DEPARTMENT_STAFF"], departmentId),
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
  );
  return store;
}

describe("issue photographs", () => {
  it("accepts jpeg, png, and webp bytes and rejects svg, oversized, and extra files", () => {
    const accepted = validateIssueImages([
      { bytes: jpeg, declaredName: "..\\..\\secret.jpg" },
      { bytes: png, declaredName: "photo.png" },
      { bytes: webp, declaredName: "photo.webp" },
    ]);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.images[0]?.mimeType, "image/jpeg");
    assert.equal(accepted.images[0]?.originalFilename, "secret.jpg");
    assert.match(accepted.images[0]?.storageKey ?? "", /^[0-9a-f-]{36}\.jpg$/);
    assert.equal(validateIssueImages([{ bytes: svg, declaredName: "drawing.svg" }]).ok, false);
    assert.equal(
      validateIssueImages([{ bytes: jpeg, declaredName: "photo.svg" }]).ok,
      true,
    );
    const oversized = new Uint8Array(MAX_ISSUE_IMAGE_BYTES + 1);
    oversized.set(jpeg);
    assert.equal(validateIssueImages([{ bytes: oversized, declaredName: "big.jpg" }]).ok, false);
    assert.equal(
      validateIssueImages(Array.from({ length: 5 }, () => ({ bytes: jpeg, declaredName: "a.jpg" })))
        .ok,
      false,
    );
  });

  it("stores images only on the new report owned by the reporter", async () => {
    const store = preparedStore();
    const prepared = validateIssueImages([{ bytes: png, declaredName: "crack.png" }]);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    const created = await createCitizenIssue(citizen(citizenId), draft, store, now, null, prepared.images);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(store.images.length, 1);
    assert.equal(store.images[0]?.issueId, created.issueId);
    assert.equal(store.images[0]?.uploadedById, citizenId);
    const detail = await getCitizenIssue(citizen(citizenId), created.issueId, store);
    assert.equal(detail.ok && detail.issue.images.length, 1);
    const hidden = await getCitizenIssue(citizen(otherCitizenId), created.issueId, store);
    assert.deepEqual(hidden, { ok: false, reason: "missing" });

    const duplicate = await createCitizenIssue(
      citizen(citizenId),
      draft,
      store,
      new Date(now.getTime() + 1_000),
      null,
      prepared.images,
    );
    assert.equal(duplicate.ok && duplicate.duplicate, true);
    assert.equal(store.images.length, 1);

    store.failAt = "history";
    const rolled = await createCitizenIssue(
      citizen(citizenId),
      { ...draft, title: "Second broken footpath" },
      store,
      later,
      null,
      prepared.images,
    );
    assert.deepEqual(rolled, { ok: false, message: ISSUE_SAVE_FAILED, fieldErrors: {} });
    assert.equal(store.images.length, 1);
    assert.equal(store.issues.length, 1);
  });

  it("allows the reporter and the owning department to read an image", () => {
    const shared = {
      reporterId: citizenId,
      assignmentDepartmentId: departmentA,
      unassignedClaimable: false,
    };
    assert.equal(
      canReadIssueImage({
        ...shared,
        userId: citizenId,
        departmentId: null,
        canWorkDepartment: false,
      }),
      true,
    );
    assert.equal(
      canReadIssueImage({
        ...shared,
        userId: otherCitizenId,
        departmentId: null,
        canWorkDepartment: false,
      }),
      false,
    );
    assert.equal(
      canReadIssueImage({
        ...shared,
        userId: staffId,
        departmentId: departmentA,
        canWorkDepartment: true,
      }),
      true,
    );
    assert.equal(
      canReadIssueImage({
        ...shared,
        userId: otherStaffId,
        departmentId: departmentB,
        canWorkDepartment: true,
      }),
      false,
    );
    assert.equal(
      canReadIssueImage({
        userId: staffId,
        reporterId: citizenId,
        departmentId: departmentA,
        canWorkDepartment: false,
        assignmentDepartmentId: null,
        unassignedClaimable: true,
      }),
      false,
    );
    assert.equal(
      canReadIssueImage({
        userId: staffId,
        reporterId: citizenId,
        departmentId: departmentA,
        canWorkDepartment: true,
        assignmentDepartmentId: null,
        unassignedClaimable: true,
      }),
      true,
    );
  });
});

describe("in-app notifications", () => {
  it("maps verified and resolved reports onto the existing notification types", () => {
    assert.equal(statusNotification("VERIFIED").type, "ISSUE_VERIFIED");
    assert.equal(statusNotification("RESOLVED").type, "ISSUE_RESOLVED");
    assert.equal(statusNotification("IN_PROGRESS").type, "STATUS_CHANGED");
  });

  it("notifies the citizen and assignee without repeating a note-only update", async () => {
    const store = preparedStore();
    const created = await createCitizenIssue(citizen(citizenId), draft, store, now, null);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const assigned = await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId: created.issueId, assigneeId: colleagueId, note: "Taken by roads" },
      store,
      later,
      null,
    );
    assert.equal(assigned.ok, true);
    assert.deepEqual(
      store.notifications.map((row) => row.type).sort(),
      ["ISSUE_ASSIGNED", "STATUS_CHANGED"],
    );
    assert.equal(
      store.notifications.find((row) => row.type === "ISSUE_ASSIGNED")?.recipientId,
      colleagueId,
    );
    assert.equal(
      store.notifications.find((row) => row.type === "STATUS_CHANGED")?.recipientId,
      citizenId,
    );

    const repeated = await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId: created.issueId, assigneeId: colleagueId, note: "Taken by roads" },
      store,
      later,
      null,
    );
    assert.equal(repeated.ok, true);
    assert.equal(store.notifications.length, 2);

    const noted = await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId: created.issueId, assigneeId: colleagueId, note: "Updated note" },
      store,
      later,
      null,
    );
    assert.equal(noted.ok, true);
    assert.equal(store.notifications.length, 2);

    const progress = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId: created.issueId, toStatus: "IN_PROGRESS", reason: "" },
      store,
      later,
      null,
    );
    const resolved = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId: created.issueId, toStatus: "RESOLVED", reason: "" },
      store,
      later,
      null,
    );
    assert.equal(progress.ok && resolved.ok, true);
    assert.equal(
      store.notifications.filter((row) => row.recipientId === citizenId).at(-1)?.type,
      "ISSUE_RESOLVED",
    );

    const comment = await commentOnDepartmentIssue(
      staff(staffId, departmentA),
      { issueId: created.issueId, body: "The repair is scheduled." },
      store,
      later,
      null,
    );
    assert.equal(comment.ok, true);
    const added = store.notifications.at(-1);
    assert.equal(added?.type, "COMMENT_ADDED");
    assert.equal(added?.recipientId, citizenId);
    assert.equal(added?.body.includes("The repair is scheduled."), false);
    assert.equal(store.notifications.some((row) => row.recipientId === otherStaffId), false);
  });

  it("rolls back a notification when the department update fails", async () => {
    const store = preparedStore();
    const created = await createCitizenIssue(citizen(citizenId), draft, store, now, null);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await assignDepartmentIssue(
      staff(staffId, departmentA),
      { issueId: created.issueId, assigneeId: "", note: "" },
      store,
      later,
      null,
    );
    const before = store.notifications.length;
    store.failAt = "audit";
    const failed = await changeDepartmentStatus(
      staff(staffId, departmentA),
      { issueId: created.issueId, toStatus: "IN_PROGRESS", reason: "" },
      store,
      later,
      null,
    );
    assert.equal(failed.ok, false);
    assert.equal(store.notifications.length, before);
    assert.equal(store.issues[0]?.status, "ASSIGNED");
  });

  it("marks only the recipient's notifications as read", async () => {
    const notices = new MemoryNotificationStore();
    notices.add({
      recipientId: citizenId,
      type: "STATUS_CHANGED",
      title: "Report status changed",
      body: "Your report is now In progress.",
      issueId: categoryId,
      commentId: null,
      createdAt: now,
    });
    notices.add({
      recipientId: colleagueId,
      type: "ISSUE_ASSIGNED",
      title: "Report assigned to you",
      body: "A report was assigned to you.",
      issueId: categoryId,
      commentId: null,
      createdAt: later,
    });
    const ownId = notices.rows.find((row) => row.recipientId === citizenId)?.id ?? "";
    const otherId = notices.rows.find((row) => row.recipientId === colleagueId)?.id ?? "";

    const page = await listUserNotifications(citizenId, 1, notices);
    assert.equal(page.ok && page.total, 1);
    assert.equal(page.ok && page.unread, 1);
    assert.equal(await markOwnedNotification(colleagueId, ownId, notices, later), "missing");
    assert.equal(notices.rows.find((row) => row.id === ownId)?.readAt, null);
    assert.equal(await markOwnedNotification(citizenId, "not-a-uuid", notices, later), "missing");
    assert.equal(await markOwnedNotification(citizenId, noticeId, notices, later), "missing");
    assert.equal(await markOwnedNotification(citizenId, ownId, notices, later), "updated");
    assert.equal(await markAllOwnedNotifications(citizenId, notices, later), "updated");
    assert.equal(notices.rows.find((row) => row.id === otherId)?.readAt, null);
    assert.equal(await notices.unreadCount(colleagueId), 1);
  });
});
