import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Capability } from "./capabilities";
import { MemoryAuthStore } from "./memory-store";
import {
  clientAddress,
  safeCallbackUrl,
  secureSessionCookies,
  sessionCookiePolicy,
  trustedProxyHops,
} from "./request-security";
import { authenticate, authorizationForSession, changeOwnPassword, registerAccount } from "./service";
import { assessToken } from "./store";

const now = new Date("2026-10-09T12:00:00.000Z");
const password = "a-long-enough-passphrase";
const base = "http://localhost:3000";

describe("callback URLs and cookies", () => {
  it("keeps redirects on the application origin", () => {
    assert.equal(safeCallbackUrl("/account", base), `${base}/account`);
    assert.equal(safeCallbackUrl(`${base}/account`, base), `${base}/account`);
    assert.equal(safeCallbackUrl("//evil.example", base), base);
    assert.equal(safeCallbackUrl("https://evil.example/account", base), base);
    assert.equal(safeCallbackUrl("javascript:alert(1)", base), base);
    assert.equal(safeCallbackUrl("/\\evil.example", base), base);
  });

  it("marks session cookies HttpOnly and Secure only for https", () => {
    assert.equal(secureSessionCookies("https://civic.example"), true);
    assert.equal(secureSessionCookies("http://localhost:3000"), false);
    assert.deepEqual(sessionCookiePolicy(true), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
  });
});

describe("proxy client address", () => {
  it("uses the proxy-appended address instead of a spoofed leftmost value", () => {
    const headers = { get: (name: string) => (name === "x-forwarded-for" ? "198.51.100.9, 203.0.113.5" : null) };
    assert.equal(clientAddress(headers, trustedProxyHops("1")), "203.0.113.5");
    assert.equal(clientAddress({ get: () => "not-an-ip" }, 1), "unknown");
    assert.equal(clientAddress({ get: (name) => (name === "x-real-ip" ? "203.0.113.8" : null) }, 1), "203.0.113.8");
  });
});

describe("credentials session", () => {
  it("accepts a new citizen and invalidates the old password marker after a change", async () => {
    const store = new MemoryAuthStore();
    const registered = await registerAccount(
      store,
      { email: "Ada@Example.com", name: "Ada Lovelace", password },
      now,
    );
    assert.equal(registered.error, false);
    assert.equal(JSON.stringify(registered).includes("SUPABASE"), false);
    const success = await authenticate(store, "ada@example.com", password);
    assert.equal(success.ok, true);
    if (!success.ok) return;

    const user = await store.findUserById(success.userId);
    assert.equal(assessToken(user, success.passwordChangedAt, "credentials"), "ok");
    const access = await authorizationForSession(store, { user: { id: success.userId } }, "spoofed-dept");
    assert.equal(access?.email, "ada@example.com");
    assert.deepEqual(access?.roleCodes, ["CITIZEN"]);
    assert.equal(access?.departmentId, null);
    assert.equal(access?.capabilities.has(Capability.accountSelf), true);
    assert.equal(access?.capabilities.has(Capability.roleGrant), false);

    const changed = await changeOwnPassword(
      store,
      success.userId,
      {
        currentPassword: password,
        nextPassword: "another-long-passphrase",
        confirmPassword: "another-long-passphrase",
      },
      new Date(now.getTime() + 60_000),
    );
    assert.equal(changed.error, false);
    assert.equal(assessToken(await store.findUserById(success.userId), success.passwordChangedAt), "blocked");
    assert.equal((await authenticate(store, "ada@example.com", password)).ok, false);
    assert.equal((await authenticate(store, "ada@example.com", "another-long-passphrase")).ok, true);
    store.users[0].accountStatus = "DISABLED";
    store.users[0].disabledAt = now;
    assert.equal(await authorizationForSession(store, { user: { id: success.userId } }), null);
  });

  it("registers without SMTP settings and does not create an administrator", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.EMAIL_FROM;
    const store = new MemoryAuthStore();
    const registered = await registerAccount(
      store,
      { email: "ada@example.com", name: "Ada", password },
      now,
    );
    assert.equal(registered.error, false);
    assert.equal(store.users.length, 1);
    assert.deepEqual(await store.activeRoleCodes(store.users[0].id), ["CITIZEN"]);
  });
});
