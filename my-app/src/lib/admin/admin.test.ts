import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryAdminStore } from "@/lib/admin/memory-store";
import {
  ADMIN_DEPARTMENT_BLOCKED,
  ADMIN_DUPLICATE,
  ADMIN_FORBIDDEN,
  ADMIN_INVALID,
  ADMIN_LAST,
  ADMIN_MEMBERSHIP_BLOCKED,
  ADMIN_SELF,
  ADMIN_SIGN_IN,
} from "@/lib/admin/messages";
import { decideBootstrap, normalizeCode } from "@/lib/admin/rules";
import {
  addAdminMembership,
  createAdminCategory,
  createAdminDepartment,
  endAdminMembership,
  grantAdminRole,
  provisionAdminStaff,
  revokeAdminRole,
  setAdminAccountStatus,
  setAdminCategoryActive,
  setAdminDepartmentActive,
  updateAdminDepartment,
} from "@/lib/admin/service";
import type { AdminAccess } from "@/lib/admin/types";
import type { MemoryAdminUser } from "@/lib/admin/store";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import { isAdminProvisionedMetadata, isEligible, mustReplaceProvisionedPassword } from "@/lib/auth/store";

const now = new Date("2026-10-09T12:00:00.000Z");
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const staffId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const citizenId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function admin(userId = adminId): AdminAccess {
  return { userId, capabilities: capabilitiesFor(["ADMINISTRATOR"], null) };
}

function person(input: Partial<MemoryAdminUser> & Pick<MemoryAdminUser, "id" | "roles">): MemoryAdminUser {
  return {
    email: `${input.id.slice(0, 8)}@example.com`,
    name: "Person",
    accountStatus: "ACTIVE",
    disabledAt: null,
    ...input,
  };
}

function prepared() {
  const store = new MemoryAdminStore();
  store.users.push(
    person({ id: adminId, email: "ada@example.com", name: "Ada Admin", roles: ["ADMINISTRATOR"] }),
    person({ id: staffId, email: "sam@example.com", name: "Sam Staff", roles: ["DEPARTMENT_STAFF"] }),
    person({ id: citizenId, email: "cara@example.com", name: "Cara Citizen", roles: ["CITIZEN"] }),
  );
  return store;
}

describe("admin authorization", () => {
  it("refuses signed-out and non-admin changes", async () => {
    const store = prepared();
    const signedOut = await createAdminDepartment(
      null,
      { code: "ROADS", name: "Roads", description: "" },
      store,
      now,
      null,
    );
    const citizen = await grantAdminRole(
      { userId: citizenId, capabilities: capabilitiesFor(["CITIZEN"], null) },
      { userId: staffId, role: "ADMINISTRATOR" },
      store,
      now,
      null,
    );
    const partial = await setAdminAccountStatus(
      { userId: adminId, capabilities: new Set(["role.grant"]) },
      { userId: citizenId, status: "DISABLED" },
      store,
      now,
      null,
    );
    assert.equal(signedOut.ok, false);
    if (!signedOut.ok) assert.equal(signedOut.message, ADMIN_SIGN_IN);
    assert.equal(citizen.ok, false);
    if (!citizen.ok) assert.equal(citizen.message, ADMIN_FORBIDDEN);
    assert.equal(partial.ok, false);
    if (!partial.ok) assert.equal(partial.message, ADMIN_FORBIDDEN);
    assert.equal(store.departments.length, 0);
    assert.equal(store.audits.length, 0);
    assert.deepEqual(store.users[2]?.roles, ["CITIZEN"]);
  });

  it("refuses an administrator changing their own access", async () => {
    const store = prepared();
    const grant = await grantAdminRole(admin(), { userId: adminId, role: "CITIZEN" }, store, now, null);
    const revoke = await revokeAdminRole(admin(), { userId: adminId, role: "ADMINISTRATOR" }, store, now, null);
    const status = await setAdminAccountStatus(admin(), { userId: adminId, status: "SUSPENDED" }, store, now, null);
    assert.equal(grant.ok, false);
    assert.equal(revoke.ok, false);
    assert.equal(status.ok, false);
    if (!grant.ok) assert.equal(grant.message, ADMIN_SELF);
    assert.deepEqual(store.users[0]?.roles, ["ADMINISTRATOR"]);
    assert.equal(store.users[0]?.accountStatus, "ACTIVE");
  });
});

describe("departments and memberships", () => {
  it("creates a department and rejects a duplicate code or name", async () => {
    const store = prepared();
    const created = await createAdminDepartment(
      admin(),
      { code: "public safety", name: "Public Safety", description: "Hazards" },
      store,
      now,
      "203.0.113.10",
    );
    const duplicate = await createAdminDepartment(
      admin(),
      { code: "PUBLIC_SAFETY", name: "Another", description: "" },
      store,
      now,
      null,
    );
    assert.equal(created.ok, true);
    assert.equal(store.departments[0]?.code, "PUBLIC_SAFETY");
    assert.equal(store.audits[0]?.action, "department.create");
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.message, ADMIN_DUPLICATE);
    assert.equal(store.departments.length, 1);
  });

  it("refuses deactivation while assignments or memberships are open", async () => {
    const store = prepared();
    const created = await createAdminDepartment(
      admin(),
      { code: "ROADS", name: "Roads", description: "" },
      store,
      now,
      null,
    );
    assert.equal(created.ok, true);
    const departmentId = store.departments[0]?.id ?? "";
    store.issues.push({ id: "11111111-1111-4111-8111-111111111111", status: "REPORTED" });
    store.assignments.push({
      id: "22222222-2222-4222-8222-222222222222",
      issueId: store.issues[0]?.id ?? "",
      departmentId,
      assigneeId: staffId,
      endedAt: null,
    });
    const blocked = await setAdminDepartmentActive(admin(), { id: departmentId, isActive: false }, store, now, null);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.message, ADMIN_DEPARTMENT_BLOCKED);
    assert.equal(store.departments[0]?.isActive, true);
    assert.equal(store.issues.length, 1);
    store.assignments[0]!.endedAt = now;
    const joined = await addAdminMembership(admin(), { departmentId, userId: staffId }, store, now, null);
    assert.equal(joined.ok, true);
    const stillBlocked = await setAdminDepartmentActive(
      admin(),
      { id: departmentId, isActive: false },
      store,
      now,
      null,
    );
    assert.equal(stillBlocked.ok, false);
    const membershipId = store.memberships[0]?.id ?? "";
    const ended = await endAdminMembership(admin(), membershipId, store, now, null);
    assert.equal(ended.ok, true);
    const closed = await setAdminDepartmentActive(admin(), { id: departmentId, isActive: false }, store, now, null);
    assert.equal(closed.ok, true);
    assert.equal(store.departments[0]?.isActive, false);
    assert.equal(store.assignments.length, 1);
  });

  it("adds only eligible staff and keeps the assignment when membership ends", async () => {
    const store = prepared();
    await createAdminDepartment(admin(), { code: "WATER", name: "Water", description: "" }, store, now, null);
    const departmentId = store.departments[0]?.id ?? "";
    const citizen = await addAdminMembership(admin(), { departmentId, userId: citizenId }, store, now, null);
    assert.equal(citizen.ok, false);
    if (!citizen.ok) assert.equal(citizen.message, ADMIN_MEMBERSHIP_BLOCKED);
    const added = await addAdminMembership(admin(), { departmentId, userId: staffId }, store, now, null);
    assert.equal(added.ok, true);
    await createAdminDepartment(admin(), { code: "PARKS", name: "Parks", description: "" }, store, now, null);
    const secondDepartment = store.departments[1]?.id ?? "";
    const elsewhere = await addAdminMembership(
      admin(),
      { departmentId: secondDepartment, userId: staffId },
      store,
      now,
      null,
    );
    assert.equal(elsewhere.ok, false);
    store.assignments.push({
      id: "33333333-3333-4333-8333-333333333333",
      issueId: "44444444-4444-4444-8444-444444444444",
      departmentId,
      assigneeId: staffId,
      endedAt: null,
    });
    const ended = await endAdminMembership(admin(), store.memberships[0]?.id ?? "", store, now, null);
    assert.equal(ended.ok, true);
    assert.equal(store.memberships[0]?.endedAt instanceof Date, true);
    assert.equal(store.assignments[0]?.assigneeId, null);
    assert.equal(store.assignments[0]?.endedAt, null);
    assert.equal(store.audits.at(-1)?.action, "membership.end");
  });

  it("rejects an invalid department code before writing", async () => {
    const store = prepared();
    const result = await updateAdminDepartment(
      admin(),
      { id: "not-a-uuid", name: "Roads", description: "" },
      store,
      now,
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, ADMIN_INVALID);
    assert.equal(normalizeCode("a"), null);
  });
});

describe("categories, roles, and bootstrap rules", () => {
  it("keeps a deactivated category and its reports", async () => {
    const store = prepared();
    const created = await createAdminCategory(
      admin(),
      { code: "roads", name: "Roads and pavements", sortOrder: "10" },
      store,
      now,
      null,
    );
    const duplicate = await createAdminCategory(
      admin(),
      { code: "ROADS", name: "Other roads", sortOrder: "11" },
      store,
      now,
      null,
    );
    assert.equal(created.ok, true);
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.message, ADMIN_DUPLICATE);
    store.issues.push({ id: "55555555-5555-4555-8555-555555555555", status: "REPORTED" });
    const categoryId = store.categories[0]?.id ?? "";
    const deactivated = await setAdminCategoryActive(admin(), { id: categoryId, isActive: false }, store, now, null);
    assert.equal(deactivated.ok, true);
    assert.equal(store.categories.length, 1);
    assert.equal(store.categories[0]?.isActive, false);
    assert.equal(store.categories[0]?.code, "ROADS");
    assert.equal(store.issues.length, 1);
  });

  it("protects the last active administrator", async () => {
    const store = prepared();
    store.users.push(person({ id: secondId, email: "bea@example.com", name: "Bea Admin", roles: ["CITIZEN"] }));
    const granted = await grantAdminRole(admin(), { userId: secondId, role: "ADMINISTRATOR" }, store, now, null);
    assert.equal(granted.ok, true);

    const removed = await revokeAdminRole(admin(), { userId: secondId, role: "ADMINISTRATOR" }, store, now, null);
    assert.equal(removed.ok, true);
    const grantedAgain = await grantAdminRole(admin(), { userId: secondId, role: "ADMINISTRATOR" }, store, now, null);
    assert.equal(grantedAgain.ok, true);

    const suspended = store.users[0];
    assert.ok(suspended);
    suspended.accountStatus = "SUSPENDED";
    const lockout = await setAdminAccountStatus(
      admin(),
      { userId: secondId, status: "DISABLED" },
      store,
      now,
      null,
    );
    const revoke = await revokeAdminRole(admin(), { userId: secondId, role: "ADMINISTRATOR" }, store, now, null);
    assert.equal(lockout.ok, false);
    assert.equal(revoke.ok, false);
    if (!lockout.ok) assert.equal(lockout.message, ADMIN_LAST);
    if (!revoke.ok) assert.equal(revoke.message, ADMIN_LAST);
    assert.equal(store.users.find((user) => user.id === secondId)?.accountStatus, "ACTIVE");
    assert.equal(store.users.find((user) => user.id === secondId)?.roles.includes("ADMINISTRATOR"), true);
  });

  it("decides bootstrap only for a confirmed empty installation", () => {
    const ready = {
      confirmed: true,
      email: "ada@example.com",
      name: "Ada Admin",
      passwordError: null,
      hasAdminRole: true,
      activeAdminCount: 0,
      userCount: 0,
    };
    assert.deepEqual(decideBootstrap(ready), { ok: true });
    assert.equal(decideBootstrap({ ...ready, confirmed: false }).ok, false);
    assert.equal(decideBootstrap({ ...ready, email: null }).ok, false);
    assert.equal(decideBootstrap({ ...ready, name: null }).ok, false);
    assert.equal(decideBootstrap({ ...ready, passwordError: "short" }).ok, false);
    assert.equal(decideBootstrap({ ...ready, hasAdminRole: false }).ok, false);
    assert.equal(decideBootstrap({ ...ready, activeAdminCount: 1 }).ok, false);
    assert.equal(decideBootstrap({ ...ready, userCount: 1 }).ok, false);
  });
});

describe("staff provisioning", () => {
  const password = "a-long-enough-passphrase";

  it("creates department staff without confirming email or granting administrator", async () => {
    const store = prepared();
    await createAdminDepartment(admin(), { code: "ROADS", name: "Roads", description: "" }, store, now, null);
    const departmentId = store.departments[0]?.id ?? "";
    const created = await provisionAdminStaff(
      admin(),
      {
        name: "Sam Staff",
        email: "Sam.Staff@Example.com",
        password,
        confirmPassword: password,
        departmentId,
        confirm: "yes",
      },
      store,
      now,
      null,
    );
    assert.equal(created.ok, true);
    const staffUser = store.users.find((user) => user.email === "sam.staff@example.com");
    assert.ok(staffUser);
    assert.equal(staffUser.adminProvisioned, true);
    assert.deepEqual(staffUser.roles, ["DEPARTMENT_STAFF"]);
    assert.equal(store.memberships.some((row) => row.userId === staffUser.id && row.endedAt === null), true);
    const audit = store.audits.find((row) => row.action === "staff.provision");
    assert.deepEqual(audit?.metadata, {
      activation: "admin-activated",
      emailVerified: "false",
      role: "DEPARTMENT_STAFF",
      departmentId,
    });
    assert.equal(JSON.stringify(audit).includes(password), false);
    const credential = store.credentials.find((row) => row.userId === staffUser.id);
    assert.equal(credential?.passwordHash.startsWith("$argon2id$"), true);
    assert.equal(credential?.passwordHash.includes(password), false);
    assert.equal(isAdminProvisionedMetadata(audit?.metadata), true);
    assert.equal(
      isEligible({
        id: staffUser.id,
        email: staffUser.email,
        name: staffUser.name,
        accountStatus: "ACTIVE",
        disabledAt: null,
        passwordHash: credential?.passwordHash ?? null,
        passwordChangedAt: now,
        passwordCreatedAt: now,
        adminProvisioned: true,
      }),
      true,
    );
    assert.equal(
      isEligible({
        id: citizenId,
        email: "cara@example.com",
        name: "Cara Citizen",
        accountStatus: "ACTIVE",
        disabledAt: null,
        passwordHash: "hash",
        passwordChangedAt: now,
      }),
      true,
    );
    assert.equal(
      mustReplaceProvisionedPassword({
        id: staffUser.id,
        email: staffUser.email,
        name: staffUser.name,
        accountStatus: "ACTIVE",
        disabledAt: null,
        passwordHash: credential?.passwordHash ?? null,
        passwordChangedAt: now,
        passwordCreatedAt: now,
        adminProvisioned: true,
      }),
      true,
    );
  });

  it("refuses an unconfirmed, duplicate, or invalid staff provision", async () => {
    const store = prepared();
    const unconfirmed = await provisionAdminStaff(
      admin(),
      {
        name: "Sam Staff",
        email: "sam.staff@example.com",
        password,
        confirmPassword: password,
        departmentId: "",
        confirm: "",
      },
      store,
      now,
      null,
    );
    assert.equal(unconfirmed.ok, false);
    assert.equal(store.users.some((user) => user.email === "sam.staff@example.com"), false);
    const created = await provisionAdminStaff(
      admin(),
      {
        name: "Sam Staff",
        email: "sam.staff@example.com",
        password,
        confirmPassword: password,
        departmentId: "",
        confirm: "yes",
      },
      store,
      now,
      null,
    );
    assert.equal(created.ok, true);
    const duplicate = await provisionAdminStaff(
      admin(),
      {
        name: "Sam Staff",
        email: "sam.staff@example.com",
        password,
        confirmPassword: password,
        departmentId: "",
        confirm: "yes",
      },
      store,
      now,
      null,
    );
    assert.equal(duplicate.ok, false);
    const before = store.users.length;
    const missingDepartment = await provisionAdminStaff(
      admin(),
      {
        name: "Other Staff",
        email: "other.staff@example.com",
        password,
        confirmPassword: password,
        departmentId: "99999999-9999-4999-8999-999999999999",
        confirm: "yes",
      },
      store,
      now,
      null,
    );
    assert.equal(missingDepartment.ok, false);
    assert.equal(store.users.length, before);
    const forbidden = await provisionAdminStaff(
      { userId: citizenId, capabilities: capabilitiesFor(["CITIZEN"], null) },
      {
        name: "Other Staff",
        email: "other.staff@example.com",
        password,
        confirmPassword: password,
        departmentId: "",
        confirm: "yes",
      },
      store,
      now,
      null,
    );
    assert.equal(forbidden.ok, false);
    assert.equal(store.users.length, before);
  });
});
