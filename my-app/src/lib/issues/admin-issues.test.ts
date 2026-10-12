import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_PAGE_SIZE, type AdminAccess } from "@/lib/admin/types";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import {
  browseAdminIssues,
  inspectAdminIssue,
  type AdminIssueInspection,
  type AdminIssueReadStore,
  type AdminIssueSummary,
} from "@/lib/issues/admin-issues";
import type { IssueStatus, Severity } from "@/generated/prisma/enums";

const now = new Date("2026-10-12T08:00:00.000Z");

function admin(): AdminAccess {
  return { userId: "admin", capabilities: capabilitiesFor(["ADMINISTRATOR"], null) };
}

function summary(title: string): AdminIssueSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title,
    categoryName: "Roads",
    severity: "MEDIUM" as Severity,
    status: "REPORTED" as IssueStatus,
    createdAt: now,
    reporterName: "Ada",
    departmentName: null,
    assigneeName: null,
    deletedAt: null,
  };
}

function store(items: AdminIssueSummary[]): AdminIssueReadStore & { reads: number } {
  return {
    reads: 0,
    async search(query, page, pageSize) {
      this.reads += 1;
      const matched = items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
      return { total: matched.length, items: matched.slice((page - 1) * pageSize, page * pageSize) };
    },
    async inspect(id): Promise<AdminIssueInspection | null> {
      this.reads += 1;
      const item = items.find((row) => row.id === id);
      if (!item) return null;
      return {
        ...item,
        description: "The footpath is cracked.",
        location: { description: "12 Library Road", locality: "Shivajinagar", city: "Pune", postalCode: null },
        comments: [],
        history: [],
        images: [],
      };
    },
  };
}

describe("admin issue inspection", () => {
  it("refuses a signed-out or non-admin reader before listing reports", async () => {
    const memory = store([summary("Broken footpath")]);
    const signedOut = await browseAdminIssues(null, "", 1, memory);
    const citizen = await browseAdminIssues(
      { userId: "citizen", capabilities: capabilitiesFor(["CITIZEN"], null) },
      "",
      1,
      memory,
    );
    assert.equal(signedOut.ok, false);
    assert.equal(citizen.ok, false);
    if (!citizen.ok) assert.equal(citizen.reason, "forbidden");
    assert.equal(memory.reads, 0);
  });

  it("lists a matching report for an administrator and ignores a page past the end", async () => {
    const memory = store([summary("Broken footpath"), summary("Dark street")]);
    memory.search = async function search(query) {
      this.reads += 1;
      const matched = [summary("Broken footpath"), summary("Dark street")].filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      );
      return { total: matched.length, items: matched.slice(0, ADMIN_PAGE_SIZE) };
    };
    const result = await browseAdminIssues(admin(), "  footpath ", "4", memory);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.query, "footpath");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.reporterName, "Ada");
  });

  it("does not inspect a report for a department account", async () => {
    const memory = store([summary("Broken footpath")]);
    const result = await inspectAdminIssue(
      { userId: "staff", capabilities: capabilitiesFor(["DEPARTMENT_STAFF"], "dept") },
      summary("Broken footpath").id,
      memory,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "forbidden");
    assert.equal(memory.reads, 0);
  });
});
