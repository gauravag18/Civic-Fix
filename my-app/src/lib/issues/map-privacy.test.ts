import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { SlidingWindowLimiter } from "@/lib/auth/rate-limit";
import {
  EXACT_COORDINATES_ARE_PRIVATE,
  getPublicIssue,
  listPublicIssues,
  publicMapItem,
  publicMapItemKeys,
  publicMapPlacement,
} from "@/lib/issues/discovery";
import { MemoryIssueStore } from "@/lib/issues/memory-store";
import { FIELD_COORDINATE_PAIR, FIELD_LATITUDE, FIELD_LONGITUDE } from "@/lib/issues/messages";
import { createCitizenIssue, getCitizenIssue } from "@/lib/issues/service";
import { parseCoordinatePair, validateIssueFields, type RawIssueFields } from "@/lib/issues/validate";

const now = new Date("2026-10-10T09:00:00.000Z");
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

describe("map coordinates and public placement", () => {
  it("accepts a coordinate pair and rejects a partial or out-of-range point", () => {
    const paired = validateIssueFields(valid);
    assert.equal(paired.ok, true);
    if (paired.ok) {
      assert.equal(paired.value.latitude, "18.520400");
      assert.equal(paired.value.longitude, "73.856700");
    }
    const blank = validateIssueFields({ ...valid, latitude: "", longitude: "" });
    assert.equal(blank.ok, true);
    if (blank.ok) {
      assert.equal(blank.value.latitude, null);
      assert.equal(blank.value.longitude, null);
    }

    const half = validateIssueFields({ ...valid, latitude: "18.5", longitude: "" });
    assert.equal(half.ok, false);
    if (!half.ok) assert.equal(half.fieldErrors.latitude, FIELD_COORDINATE_PAIR);

    const high = validateIssueFields({ ...valid, latitude: "91", longitude: "73.8" });
    assert.equal(high.ok, false);
    if (!high.ok) assert.equal(high.fieldErrors.latitude, FIELD_LATITUDE);

    const west = validateIssueFields({ ...valid, latitude: "18.5", longitude: "181" });
    assert.equal(west.ok, false);
    if (!west.ok) assert.equal(west.fieldErrors.longitude, FIELD_LONGITUDE);

    const precise = validateIssueFields({ ...valid, latitude: "18.1234567", longitude: "73.1" });
    assert.equal(precise.ok, false);
    if (!precise.ok) assert.equal(precise.fieldErrors.latitude, FIELD_LATITUDE);

    assert.deepEqual(parseCoordinatePair("18.520400", "73.856700"), {
      latitude: 18.5204,
      longitude: 73.8567,
    });
    assert.equal(parseCoordinatePair("18.5", ""), null);
    assert.equal(parseCoordinatePair("91", "73.8"), null);
  });

  it("keeps exact coordinates out of public lists, map items, and other accounts", async () => {
    const store = new MemoryIssueStore();
    store.categories.push({
      id: categoryId,
      code: "ROADS",
      name: "Roads and pavements",
      isActive: true,
      sortOrder: 10,
    });
    const created = await createCitizenIssue(citizen(), valid, store, now, null);
    assert.equal(created.ok, true);
    const issue = store.issues[0];
    assert.ok(issue);
    assert.equal(issue.publishedAt, null);
    assert.equal(store.locations[0]?.latitude, "18.520400");

    const hidden = await listPublicIssues({}, store);
    assert.equal(hidden.ok, true);
    if (hidden.ok) {
      assert.equal(hidden.total, 0);
      assert.equal(publicMapPlacement(hidden.items).placed.length, 0);
      assert.equal(publicMapPlacement(hidden.items).withheld, 0);
    }
    const privateDetail = await getPublicIssue(issue.id, store);
    assert.equal(privateDetail.ok, false);

    issue.publishedAt = now;
    const listed = await listPublicIssues({}, store);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      const dumped = JSON.stringify(listed.items);
      assert.equal(dumped.includes("18.520400"), false);
      assert.equal(dumped.includes("73.856700"), false);
      assert.equal(dumped.includes("12 Library Road"), false);
      assert.equal(dumped.includes("411005"), false);
      assert.equal(dumped.includes(citizenId), false);
      const placement = publicMapPlacement(listed.items);
      assert.deepEqual(placement.placed, []);
      assert.equal(placement.withheld, 1);
      assert.equal(placement.reason, EXACT_COORDINATES_ARE_PRIVATE);
      const mapItem = publicMapItem(listed.items[0]!);
      assert.deepEqual(Object.keys(mapItem).sort(), [...publicMapItemKeys()].sort());
      assert.equal(JSON.stringify(mapItem).includes("18.520400"), false);
    }

    const stranger = await getCitizenIssue(citizen(otherId), issue.id, store);
    assert.equal(stranger.ok, false);
    const owner = await getCitizenIssue(citizen(), issue.id, store);
    assert.equal(owner.ok, true);
    if (owner.ok) {
      assert.equal(owner.issue.location.latitude, "18.520400");
      assert.equal(owner.issue.location.description, "12 Library Road");
    }

    issue.deletedAt = now;
    const deleted = await getPublicIssue(issue.id, store);
    assert.equal(deleted.ok, false);
    const afterDelete = await listPublicIssues({}, store);
    assert.equal(afterDelete.ok, true);
    if (afterDelete.ok) assert.equal(afterDelete.total, 0);
  });

  it("does not let another account publish a report onto the public map", async () => {
    const store = new MemoryIssueStore();
    store.categories.push({
      id: categoryId,
      code: "ROADS",
      name: "Roads and pavements",
      isActive: true,
      sortOrder: 10,
    });
    await createCitizenIssue(citizen(), valid, store, now, null);
    const { publishOwnedIssue } = await import("@/lib/issues/discovery");
    const denied = await publishOwnedIssue(
      citizen(otherId),
      { issueId: store.issues[0]!.id, intent: "publish", confirm: "yes" },
      store,
      now,
      null,
      new SlidingWindowLimiter(5, 60_000),
      now.getTime(),
    );
    assert.equal(denied.ok, false);
    assert.equal(store.issues[0]?.publishedAt, null);
    const listed = await listPublicIssues({}, store);
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(publicMapPlacement(listed.items).withheld, 0);
  });
});
