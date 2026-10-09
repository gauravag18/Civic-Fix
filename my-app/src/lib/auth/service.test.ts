import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Capability, capabilitiesFor } from "./capabilities";
import { MemoryAuthStore } from "./memory-store";
import { LOGIN_FAILURE, REGISTER_NEUTRAL } from "./messages";
import { hashPassword } from "./password";
import {
  authenticate,
  authorizationFor,
  disableAccount,
  grantRole,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./service";
import { assessToken, type StoredUser } from "./store";
import { RESET_TTL_MS, VERIFICATION_TTL_MS } from "./tokens";

const now = new Date("2026-10-09T12:00:00.000Z");
const password = "a-long-enough-passphrase";

function configuredEnv() {
  process.env.EMAIL_FROM = "CivicFix <civicfix@example.com>";
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "civicfix";
  process.env.SMTP_PASSWORD = "secret";
  process.env.APP_ORIGIN = "http://localhost:3000";
}

function recordingMailer() {
  const sent: string[] = [];
  return {
    sent,
    send: async (input: { to: string; text: string }) => {
      sent.push(input.text);
      return "sent" as const;
    },
  };
}

function tokenFrom(message: string): string {
  const value = new URL(message.split(" ").at(-1) ?? "").searchParams.get("token");
  if (!value) throw new Error("Test mail did not include a token.");
  return value;
}

describe("authentication service", () => {
  it("registers one citizen and does not reveal the verification token in the result", async () => {
    configuredEnv();
    const store = new MemoryAuthStore();
    const mail = recordingMailer();
    const result = await registerAccount(
      store,
      { email: "Ada@Example.com", name: "Ada Lovelace", password },
      now,
      mail.send,
    );
    const duplicate = await registerAccount(
      store,
      { email: "ada@example.com", name: "Ada Lovelace", password },
      now,
      mail.send,
    );

    assert.equal(result.error, false);
    assert.equal(result.message, REGISTER_NEUTRAL);
    assert.equal(JSON.stringify(result).includes("token"), false);
    assert.equal(store.users.length, 1);
    assert.deepEqual(await store.activeRoleCodes(store.users[0].id), ["CITIZEN"]);
    assert.equal(duplicate.message, REGISTER_NEUTRAL);
    assert.equal(mail.sent.length, 1);
  });

  it("uses the same login failure for unknown, wrong, unverified, and disabled accounts", async () => {
    const store = new MemoryAuthStore();
    const mail = recordingMailer();
    configuredEnv();
    await registerAccount(
      store,
      { email: "ada@example.com", name: "Ada Lovelace", password },
      now,
      mail.send,
    );
    const unknown = await authenticate(store, "missing@example.com", password);
    const wrong = await authenticate(store, "ada@example.com", "wrong-passphrase-value");
    const unverified = await authenticate(store, "ada@example.com", password);
    assert.deepEqual(unknown, { ok: false });
    assert.deepEqual(wrong, { ok: false });
    assert.deepEqual(unverified, { ok: false });

    const verified = await verifyEmail(store, tokenFrom(mail.sent[0]), now);
    assert.equal(verified.error, false);
    const success = await authenticate(store, "ada@example.com", password);
    assert.equal(success.ok, true);

    store.users[0].accountStatus = "DISABLED";
    store.users[0].disabledAt = now;
    const disabled = await authenticate(store, "ada@example.com", password);
    assert.deepEqual(disabled, { ok: false });
    assert.equal(LOGIN_FAILURE.length > 0, true);
  });

  it("rejects expired and reused verification and reset tokens", async () => {
    configuredEnv();
    const store = new MemoryAuthStore();
    const mail = recordingMailer();
    await registerAccount(
      store,
      { email: "ada@example.com", name: "Ada Lovelace", password },
      now,
      mail.send,
    );
    const verification = tokenFrom(mail.sent[0]);
    const expired = await verifyEmail(
      store,
      verification,
      new Date(now.getTime() + VERIFICATION_TTL_MS + 1),
    );
    assert.equal(expired.error, true);
    const fresh = await verifyEmail(store, verification, now);
    assert.equal(fresh.error, false);
    const reused = await verifyEmail(store, verification, now);
    assert.equal(reused.error, true);

    const resetMail = recordingMailer();
    await requestPasswordReset(store, "ada@example.com", now, resetMail.send);
    const resetToken = tokenFrom(resetMail.sent[0]);
    const expiredReset = await resetPassword(
      store,
      { token: resetToken, password: "another-long-passphrase" },
      new Date(now.getTime() + RESET_TTL_MS + 1),
    );
    assert.equal(expiredReset.error, true);
    const reset = await resetPassword(
      store,
      { token: resetToken, password: "another-long-passphrase" },
      now,
    );
    assert.equal(reset.error, false);
    const reusedReset = await resetPassword(
      store,
      { token: resetToken, password: "yet-another-passphrase" },
      now,
    );
    assert.equal(reusedReset.error, true);
    assert.equal(store.revokedSessionUsers.includes(store.users[0].id), true);
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
      emailVerifiedAt: now,
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
      emailVerifiedAt: now,
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
