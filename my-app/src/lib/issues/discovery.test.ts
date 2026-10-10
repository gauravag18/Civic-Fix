import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import {
  getPublicIssue,
  listPublicIssues,
  parsePublicQuery,
  publicIssueKeys,
  publishOwnedIssue,
} from "@/lib/issues/discovery";
import { MemoryIssueStore } from "@/lib/issues/memory-store";
import {
  PUBLICATION_CONFIRM,
  PUBLICATION_MISSING,
  PUBLICATION_RATE_LIMITED,
  PUBLICATION_SIGN_IN,
} from "@/lib/issues/messages";
import { createCitizenIssue, getCitizenIssue } from "@/lib/issues/service";
import { PUBLIC_PAGE_SIZE } from "@/lib/issues/types";
import type { RawIssueFields } from "@/lib/issues/validate";

const now = new Date("2026-10-10T08:00:00.000Z");
const categoryId = "11111111-1111-4111-8111-111111111111";
const lightingId = "22222222-2222-4222-8222-222222222222";
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

function preparedStore() {
  const store = new MemoryIssueStore();
  store.categories.push(
    { id: categoryId, code: "ROADS", name: "Roads and pavements", isActive: true, sortOrder: 10 },
    { id: lightingId, code: "LIGHTING", name: "Street lighting", isActive: true, sortOrder: 20 },
  );
  return store;
}

async function fileReport(
  store: MemoryIssueStore,
  title: string,
  at: Date,
  category = categoryId,
) {
  const result = await createCitizenIssue(
    citizen(),
    { ...valid, title, categoryId: category, description: `${valid.description} hidden-mailbox-code` },
    store,
    at,
    null,
  );
  assert.equal(result.ok, true);
  const issue = store.issues.at(-1);
  assert.ok(issue);
  return issue;
}

describe("public issue discovery", () => {
  it("keeps a new report unpublished", async () => {
    const store = preparedStore();
    const issue = await fileReport(store, "Broken footpath", now);
    assert.equal(issue.publishedAt, null);

    const listed = await listPublicIssues({}, store);
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(listed.total, 0);
    const detail = await getPublicIssue(issue.id, store);
    assert.equal(detail.ok, false);
  });

  it("lets only the owner publish and unpublish", async () => {
    const store = preparedStore();
    const issue = await fileReport(store, "Broken footpath", now);
    const limiter = new SlidingWindowLimiter(5, 60_000);
    const denied = await publishOwnedIssue(
      citizen(otherId),
      { issueId: issue.id, intent: "publish", confirm: "yes" },
      store,
      now,
      null,
      limiter,
      now.getTime(),
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.message, PUBLICATION_MISSING);
    assert.equal(issue.publishedAt, null);
    assert.equal(issue.status, "REPORTED");

    const unconfirmed = await publishOwnedIssue(
      citizen(),
      { issueId: issue.id, intent: "publish", confirm: "" },
      store,
      now,
      null,
      limiter,
      now.getTime(),
    );
    assert.equal(unconfirmed.ok, false);
    if (!unconfirmed.ok) assert.equal(unconfirmed.message, PUBLICATION_CONFIRM);
    assert.equal(issue.publishedAt, null);

    const signedOut = await publishOwnedIssue(
      null,
      { issueId: issue.id, intent: "publish", confirm: "yes" },
      store,
      now,
      null,
      limiter,
      now.getTime(),
    );
    assert.equal(signedOut.ok, false);
    if (!signedOut.ok) assert.equal(signedOut.message, PUBLICATION_SIGN_IN);

    const published = await publishOwnedIssue(
      citizen(),
      { issueId: issue.id, intent: "publish", confirm: "yes" },
      store,
      now,
      "203.0.113.10",
      limiter,
      now.getTime(),
    );
    assert.equal(published.ok, true);
    if (published.ok) assert.equal(published.publishedAt?.toISOString(), now.toISOString());
    assert.equal(issue.status, "REPORTED");
    assert.equal(store.audits.at(-1)?.action, "issue.published");
    assert.equal(JSON.stringify(store.audits.at(-1)?.metadata).includes("12 Library Road"), false);

    const stranger = await getCitizenIssue(citizen(otherId), issue.id, store);
    assert.equal(stranger.ok, false);
    const owner = await getCitizenIssue(citizen(), issue.id, store);
    assert.equal(owner.ok, true);
    if (owner.ok) assert.equal(owner.issue.description.includes("hidden-mailbox-code"), true);

    const removed = await publishOwnedIssue(
      citizen(),
      { issueId: issue.id, intent: "unpublish", confirm: "yes" },
      store,
      new Date(now.getTime() + 1000),
      null,
      limiter,
      now.getTime() + 1000,
    );
    assert.equal(removed.ok, true);
    assert.equal(issue.publishedAt, null);
    const hidden = await getPublicIssue(issue.id, store);
    assert.equal(hidden.ok, false);
    const listed = await listPublicIssues({}, store);
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(listed.total, 0);
  });

  it("limits publication changes", async () => {
    const store = preparedStore();
    const issue = await fileReport(store, "Broken footpath", now);
    const limiter = new SlidingWindowLimiter(1, 60_000);
    const first = await publishOwnedIssue(
      citizen(),
      { issueId: issue.id, intent: "publish", confirm: "yes" },
      store,
      now,
      null,
      limiter,
      now.getTime(),
    );
    const second = await publishOwnedIssue(
      citizen(),
      { issueId: issue.id, intent: "unpublish", confirm: "yes" },
      store,
      now,
      null,
      limiter,
      now.getTime(),
    );
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.message, PUBLICATION_RATE_LIMITED);
    assert.ok(issue.publishedAt);
  });

  it("rejects invalid search, filters, sort, and page values before reading", async () => {
    const store = preparedStore();
    const before = store.publicReads;
    const cases = [
      { q: "a".repeat(81) },
      { q: "street\u0000light" },
      { category: "roads" },
      { status: "OPEN" },
      { status: "reported" },
      { sort: "rank" },
    ];
    for (const input of cases) {
      const parsed = parsePublicQuery(input);
      assert.equal(parsed.ok, false);
      const listed = await listPublicIssues(input, store);
      assert.equal(listed.ok, false);
    }
    assert.equal(store.publicReads, before);
    const firstPage = parsePublicQuery({ page: "0" });
    const capped = parsePublicQuery({ page: "1001" });
    const blankSort = parsePublicQuery({ sort: "  " });
    assert.equal(firstPage.ok && firstPage.page, 1);
    assert.equal(capped.ok && capped.page, 1);
    assert.equal(blankSort.ok && blankSort.filters.sort, "newest");
  });

  it("paginates ten published reports and keeps private fields out", async () => {
    const store = preparedStore();
    const issues = [];
    for (let index = 0; index < 11; index += 1) {
      const issue = await fileReport(store, `Footpath ${index + 10}`, new Date(now.getTime() + index * 1000));
      issue.publishedAt = new Date(now.getTime() + index * 1000);
      issue.updatedAt = new Date(now.getTime() + (11 - index) * 1000);
      issues.push(issue);
    }
    issues[0]!.categoryId = lightingId;
    issues[1]!.status = "RESOLVED";
    store.comments.push({
      id: "33333333-3333-4333-8333-333333333333",
      issueId: issues[10]!.id,
      authorId: otherId,
      authorName: "Staff",
      body: "Internal note about the resident",
      createdAt: now,
      deletedAt: null,
    });

    const oversized = await store.listPublic(
      { q: "", categoryId: null, status: null, sort: "newest" },
      1,
      50,
    );
    assert.equal(oversized.ok, true);
    if (oversized.ok) {
      assert.equal(oversized.total, 11);
      assert.equal(oversized.items.length, PUBLIC_PAGE_SIZE);
    }

    const newest = await listPublicIssues({ sort: "newest" }, store);
    assert.equal(newest.ok, true);
    if (newest.ok) {
      assert.equal(newest.pageSize, 10);
      assert.equal(newest.items.length, 10);
      assert.equal(newest.items[0]?.title, "Footpath 20");
      const dumped = JSON.stringify(newest.items);
      assert.deepEqual(Object.keys(newest.items[0] ?? {}).sort(), [...publicIssueKeys()].sort());
      assert.equal(dumped.includes("hidden-mailbox-code"), false);
      assert.equal(dumped.includes("12 Library Road"), false);
      assert.equal(dumped.includes("411005"), false);
      assert.equal(dumped.includes("18.520400"), false);
      assert.equal(dumped.includes("73.856700"), false);
      assert.equal(dumped.includes(citizenId), false);
      assert.equal(dumped.includes("Internal note"), false);
    }

    const second = await listPublicIssues({ page: "2" }, store);
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.page, 2);
      assert.equal(second.items.length, 1);
      assert.equal(second.items[0]?.title, "Footpath 10");
    }

    const beyond = await listPublicIssues({ page: "9" }, store);
    assert.equal(beyond.ok, true);
    if (beyond.ok) assert.equal(beyond.page, 2);

    const updated = await listPublicIssues({ sort: "updated" }, store);
    assert.equal(updated.ok, true);
    if (updated.ok) assert.equal(updated.items[0]?.title, "Footpath 10");

    const lighting = await listPublicIssues({ category: lightingId }, store);
    assert.equal(lighting.ok, true);
    if (lighting.ok) {
      assert.equal(lighting.total, 1);
      assert.equal(lighting.items[0]?.categoryName, "Street lighting");
    }

    const resolved = await listPublicIssues({ status: "RESOLVED" }, store);
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.total, 1);
      assert.equal(resolved.items[0]?.title, "Footpath 11");
    }

    const byTitle = await listPublicIssues({ q: "Footpath 20" }, store);
    assert.equal(byTitle.ok, true);
    if (byTitle.ok) assert.equal(byTitle.total, 1);

    const byPrivateText = await listPublicIssues({ q: "hidden-mailbox-code" }, store);
    assert.equal(byPrivateText.ok, true);
    if (byPrivateText.ok) assert.equal(byPrivateText.total, 0);

    const detail = await getPublicIssue(issues[10]!.id, store);
    assert.equal(detail.ok, true);
    if (detail.ok) {
      assert.deepEqual(Object.keys(detail.issue).sort(), [...publicIssueKeys()].sort());
      assert.equal(JSON.stringify(detail.issue).includes("hidden-mailbox-code"), false);
      assert.equal(detail.issue.locality, "Shivajinagar");
      assert.equal(detail.issue.city, "Pune");
    }

    issues[10]!.deletedAt = now;
    const deletedDetail = await getPublicIssue(issues[10]!.id, store);
    assert.equal(deletedDetail.ok, false);
    const deletedList = await listPublicIssues({}, store);
    assert.equal(deletedList.ok, true);
    if (deletedList.ok) assert.equal(deletedList.total, 10);
  });
});
