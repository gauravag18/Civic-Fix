import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Capability } from "./capabilities";
import {
  authenticateGoogle,
  configuredProviderIds,
  googleProviderOptions,
  readGoogleIdentity,
} from "./google";
import { MemoryAuthStore } from "./memory-store";
import { authorizationForSession } from "./service";
import { assessToken, sessionUserId, type StoredUser } from "./store";

const now = new Date("2026-10-09T12:00:00.000Z");

function verifiedUser(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada",
    accountStatus: "ACTIVE",
    disabledAt: null,
    emailVerifiedAt: now,
    passwordHash: "hash",
    passwordChangedAt: now,
    ...overrides,
  };
}

describe("Google provider configuration", () => {
  it("stays unregistered when either credential is missing", () => {
    assert.deepEqual(configuredProviderIds({}), ["credentials"]);
    assert.deepEqual(configuredProviderIds({ GOOGLE_CLIENT_ID: "id" }), ["credentials"]);
    assert.deepEqual(configuredProviderIds({ GOOGLE_CLIENT_SECRET: "secret" }), ["credentials"]);
    assert.equal(googleProviderOptions({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "secret" }), null);
  });

  it("registers Google only when both credentials are present", () => {
    assert.deepEqual(
      configuredProviderIds({ GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" }),
      ["credentials", "google"],
    );
    assert.deepEqual(
      googleProviderOptions({ GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" }),
      { clientId: "test-client", clientSecret: "test-secret" },
    );
  });
});

describe("Google sign-in policy", () => {
  it("creates a citizen and ignores profile role claims", async () => {
    const store = new MemoryAuthStore();
    const identity = readGoogleIdentity({
      email: "Ada@Example.com",
      email_verified: true,
      name: "Ada Lovelace",
      role: "ADMINISTRATOR",
    });
    assert.equal("role" in identity, false);
    const result = await authenticateGoogle(store, identity, now);

    assert.equal(result.ok, true);
    assert.equal(store.users.length, 1);
    assert.equal(store.users[0].email, "ada@example.com");
    assert.equal(store.users[0].emailVerifiedAt?.toISOString(), now.toISOString());
    assert.equal(store.users[0].passwordHash, null);
    assert.deepEqual(await store.activeRoleCodes(store.users[0].id), ["CITIZEN"]);
    const access = await authorizationForSession(store, { user: { id: store.users[0].id } }, "spoofed");
    assert.equal(access?.capabilities.has(Capability.accountSelf), true);
    assert.equal(access?.capabilities.has(Capability.roleGrant), false);
    assert.equal(access?.departmentId, null);
  });

  it("does not create or verify an account from an unverified Google email", async () => {
    const store = new MemoryAuthStore();
    const rejected = await authenticateGoogle(
      store,
      readGoogleIdentity({ email: "ada@example.com", email_verified: false, role: "ADMINISTRATOR" }),
      now,
    );
    assert.equal(rejected.ok, false);
    assert.equal(store.users.length, 0);

    store.users.push(verifiedUser({ emailVerifiedAt: null, passwordHash: "hash" }));
    store.grants.push({ userId: "user-1", roleCode: "CITIZEN", revokedAt: null });
    const unlinked = await authenticateGoogle(
      store,
      { email: "ada@example.com", emailVerified: true, name: "Ada" },
      now,
    );
    assert.equal(unlinked.ok, false);
    assert.equal(store.users[0].emailVerifiedAt, null);
    assert.deepEqual(await store.activeRoleCodes("user-1"), ["CITIZEN"]);
  });

  it("rejects disabled and suspended accounts without changing their roles", async () => {
    const store = new MemoryAuthStore();
    store.users.push(
      verifiedUser({ id: "disabled", email: "disabled@example.com", accountStatus: "DISABLED", disabledAt: now }),
      verifiedUser({ id: "suspended", email: "suspended@example.com", accountStatus: "SUSPENDED" }),
    );
    store.grants.push(
      { userId: "disabled", roleCode: "CITIZEN", revokedAt: null },
      { userId: "suspended", roleCode: "MODERATOR", revokedAt: null },
    );

    assert.equal(
      (await authenticateGoogle(store, { email: "disabled@example.com", emailVerified: true, name: "Disabled" }, now)).ok,
      false,
    );
    assert.equal(
      (await authenticateGoogle(store, { email: "suspended@example.com", emailVerified: true, name: "Suspended" }, now)).ok,
      false,
    );
    assert.deepEqual(await store.activeRoleCodes("disabled"), ["CITIZEN"]);
    assert.deepEqual(await store.activeRoleCodes("suspended"), ["MODERATOR"]);
    assert.equal(await authorizationForSession(store, { user: { id: "suspended" } }), null);
  });

  it("matches a verified account without granting the profile's requested role", async () => {
    const store = new MemoryAuthStore();
    store.users.push(verifiedUser());
    store.grants.push({ userId: "user-1", roleCode: "CITIZEN", revokedAt: null });
    const result = await authenticateGoogle(
      store,
      readGoogleIdentity({ email: "ada@example.com", email_verified: "true", role: "ADMINISTRATOR" }),
      now,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.userId, "user-1");
    assert.equal(store.users.length, 1);
    assert.deepEqual(await store.activeRoleCodes("user-1"), ["CITIZEN"]);
  });
});

describe("session authorization", () => {
  it("treats a missing or empty user id as signed out", async () => {
    const store = new MemoryAuthStore();
    assert.equal(sessionUserId(null), null);
    assert.equal(sessionUserId({ user: { id: "" } }), null);
    assert.equal(sessionUserId({ user: { id: "  " } }), null);
    assert.equal(await authorizationForSession(store, null), null);
    assert.equal(await authorizationForSession(store, { user: { id: "" } }), null);
  });

  it("blocks a passwordless account unless the session came from Google", () => {
    const user = verifiedUser({ passwordHash: null, passwordChangedAt: null });
    assert.equal(assessToken(user, undefined, "google"), "ok");
    assert.equal(assessToken(user, undefined, "credentials"), "blocked");
    user.accountStatus = "SUSPENDED";
    assert.equal(assessToken(user, undefined, "google"), "blocked");
  });
});
