import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Capability, capabilitiesFor } from "./capabilities";
import { MemoryAuthStore } from "./memory-store";
import { LOGIN_FAILURE, REGISTER_NEUTRAL } from "./messages";
import { hashPassword } from "./password";
import {
  authenticate,
  authorizationFor,
  changeOwnPassword,
  disableAccount,
  grantRole,
  registerAccount,
} from "./service";
import { assessToken, mustReplaceProvisionedPassword, type StoredUser } from "./store";

const now = new Date("2026-10-09T12:00:00.000Z");
const password = "a-long-enough-passphrase";

describe("authentication service", () => {
  it("registers one citizen who can log in without email verification", async () => {
    const store = new MemoryAuthStore();
    const result = await registerAccount(
      store,
      { email: "Ada@Example.com", name: "Ada Lovelace", password },
      now,
    );
    const duplicate = await registerAccount(
      store,
      { email: "ada@example.com", name: "Ada Lovelace", password },
      now,
    );

    assert.equal(result.error, false);
    assert.equal(result.message, REGISTER_NEUTRAL);
    assert.equal(JSON.stringify(result).includes("token"), false);
    assert.equal(JSON.stringify(result).includes("secret"), false);
    assert.equal(store.users.length, 1);
    assert.deepEqual(await store.activeRoleCodes(store.users[0].id), ["CITIZEN"]);
    assert.equal(store.users[0].adminProvisioned, undefined);
    assert.equal(duplicate.message, REGISTER_NEUTRAL);
    assert.equal((await authenticate(store, "ada@example.com", password)).ok, true);
  });

  it("uses the same login failure for unknown, wrong, suspended, and disabled accounts", async () => {
    const store = new MemoryAuthStore();
    await registerAccount(store, { email: "ada@example.com", name: "Ada Lovelace", password }, now);
    const unknown = await authenticate(store, "missing@example.com", password);
    const wrong = await authenticate(store, "ada@example.com", "wrong-passphrase-value");
    assert.deepEqual(unknown, { ok: false });
    assert.deepEqual(wrong, { ok: false });

    const success = await authenticate(store, "ada@example.com", password);
    assert.equal(success.ok, true);

    store.users[0].accountStatus = "SUSPENDED";
    assert.deepEqual(await authenticate(store, "ada@example.com", password), { ok: false });
    store.users[0].accountStatus = "DISABLED";
    store.users[0].disabledAt = now;
    const disabled = await authenticate(store, "ada@example.com", password);
    assert.deepEqual(disabled, { ok: false });
    assert.equal(LOGIN_FAILURE.length > 0, true);
  });

  it("lets provisioned staff sign in and still change that password", async () => {
    const store = new MemoryAuthStore();
    const stored = await hashPassword(password);
    store.users.push({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "sam@example.com",
      name: "Sam Staff",
      accountStatus: "ACTIVE",
      disabledAt: null,
      passwordHash: stored,
      passwordChangedAt: now,
      passwordCreatedAt: now,
      adminProvisioned: true,
    });
    const success = await authenticate(store, "sam@example.com", password);
    assert.equal(success.ok, true);
    assert.equal(mustReplaceProvisionedPassword(store.users[0]), true);
    const changed = await changeOwnPassword(
      store,
      store.users[0].id,
      {
        currentPassword: password,
        nextPassword: "another-long-passphrase",
        confirmPassword: "another-long-passphrase",
      },
      new Date(now.getTime() + 1000),
    );
    assert.equal(changed.error, false);
    assert.equal(mustReplaceProvisionedPassword(store.users[0]), false);
    assert.equal((await authenticate(store, "sam@example.com", "another-long-passphrase")).ok, true);
  });

  it("blocks an old JWT marker after a password change and ignores spoofed departments", async () => {
    const stored = await hashPassword(password);
    const changedAt = now;
    const user: StoredUser = {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      accountStatus: "ACTIVE",
      disabledAt: null,
      passwordHash: stored,
      passwordChangedAt: changedAt,
    };
    assert.equal(assessToken(user, changedAt.getTime()), "ok");
    user.passwordChangedAt = new Date(now.getTime() + 1000);
    assert.equal(assessToken(user, changedAt.getTime()), "blocked");
    user.accountStatus = "DISABLED";
    user.disabledAt = now;
    assert.equal(assessToken(user, user.passwordChangedAt.getTime()), "blocked");

    const store = new MemoryAuthStore();
    store.users.push({
      ...user,
      accountStatus: "ACTIVE",
      disabledAt: null,
      passwordChangedAt: changedAt,
    });
    store.grants.push({ userId: "user-1", roleCode: "DEPARTMENT_STAFF", revokedAt: null });
    store.departments.set("user-1", "dept-real");
    const access = await authorizationFor(store, "user-1", "dept-spoofed");
    assert.equal(access?.departmentId, "dept-real");
    assert.equal(access?.capabilities.has(Capability.departmentWork), true);
    assert.equal(access?.capabilities.has(Capability.roleGrant), false);
  });

  it("stops citizens from granting roles or disabling accounts, including their own", async () => {
    const store = new MemoryAuthStore();
    store.roleCodes.add("CITIZEN");
    const citizen = {
      id: "citizen",
      email: "citizen@example.com",
      name: "Citizen",
      accountStatus: "ACTIVE" as const,
      disabledAt: null,
      passwordHash: "hash",
      passwordChangedAt: now,
    };
    const admin = { ...citizen, id: "admin", email: "admin@example.com" };
    const other = { ...citizen, id: "other", email: "other@example.com" };
    store.users.push(citizen, admin, other);
    store.grants.push(
      { userId: "citizen", roleCode: "CITIZEN", revokedAt: null },
      { userId: "admin", roleCode: "ADMINISTRATOR", revokedAt: null },
      { userId: "other", roleCode: "CITIZEN", revokedAt: null },
    );

    assert.equal(
      await grantRole(store, {
        actorUserId: "citizen",
        targetUserId: "other",
        roleCode: "ADMINISTRATOR",
        now,
      }),
      "forbidden",
    );
    assert.equal(
      await disableAccount(store, { actorUserId: "citizen", targetUserId: "other", now }),
      "forbidden",
    );
    assert.equal(
      await grantRole(store, {
        actorUserId: "admin",
        targetUserId: "admin",
        roleCode: "MODERATOR",
        now,
      }),
      "self",
    );
    assert.equal(
      await grantRole(store, {
        actorUserId: "admin",
        targetUserId: "other",
        roleCode: "MODERATOR",
        now,
      }),
      "granted",
    );
    assert.equal(
      (await capabilitiesFor(await store.activeRoleCodes("other"), null)).has(Capability.roleGrant),
      false,
    );
    assert.equal(
      (await capabilitiesFor(await store.activeRoleCodes("other"), null)).has(Capability.issueModerate),
      true,
    );
  });
});
