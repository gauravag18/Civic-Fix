import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Capability } from "./capabilities";
import { isEmailConfigured, isSafeAppOrigin } from "./email";
import { MemoryAuthStore } from "./memory-store";
import {
  clientAddress,
  safeCallbackUrl,
  secureSessionCookies,
  sessionCookiePolicy,
  trustedProxyHops,
} from "./request-security";
import {
  authenticate,
  authorizationForSession,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./service";
import { assessToken } from "./store";

const now = new Date("2026-10-09T12:00:00.000Z");
const password = "a-long-enough-passphrase";
const base = "http://localhost:3000";

function configuredEnv() {
  process.env.EMAIL_FROM = "CivicFix <civicfix@example.com>";
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "civicfix";
  process.env.SMTP_PASSWORD = "secret";
  process.env.APP_ORIGIN = base;
}

function recordingMailer() {
  const sent: string[] = [];
  return {
    sent,
    send: async (input: { text: string }) => {
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
  it("accepts a verified password and invalidates that marker after reset", async () => {
    configuredEnv();
    const store = new MemoryAuthStore();
    const mail = recordingMailer();
    const registered = await registerAccount(
      store,
      { email: "Ada@Example.com", name: "Ada Lovelace", password },
      now,
      mail.send,
    );
    assert.equal(registered.error, false);
    assert.equal((await authenticate(store, "ada@example.com", password)).ok, false);

    await verifyEmail(store, tokenFrom(mail.sent[0]), now);
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

    const resetMail = recordingMailer();
    const resetAt = new Date(now.getTime() + 60_000);
    await requestPasswordReset(store, "ada@example.com", now, resetMail.send);
    const resetToken = tokenFrom(resetMail.sent[0]);
    const sameAsEmail = await resetPassword(store, { token: resetToken, password: "ada@example.com" }, resetAt);
    assert.equal(sameAsEmail.error, true);
    assert.equal(assessToken(await store.findUserById(success.userId), success.passwordChangedAt), "ok");

    const reset = await resetPassword(
      store,
      { token: resetToken, password: "another-long-passphrase" },
      resetAt,
    );
    assert.equal(reset.error, false);
    assert.equal(assessToken(await store.findUserById(success.userId), success.passwordChangedAt), "blocked");
    assert.equal((await authenticate(store, "ada@example.com", password)).ok, false);
    assert.equal((await authenticate(store, "ada@example.com", "another-long-passphrase")).ok, true);
    store.users[0].accountStatus = "DISABLED";
    store.users[0].disabledAt = now;
    assert.equal(await authorizationForSession(store, { user: { id: success.userId } }), null);
  });

  it("does not register or reset when the email origin is unsafe", async () => {
    configuredEnv();
    process.env.APP_ORIGIN = "javascript:alert(1)";
    assert.equal(isSafeAppOrigin(process.env.APP_ORIGIN), false);
    assert.equal(isEmailConfigured(), false);
    const store = new MemoryAuthStore();
    const registered = await registerAccount(
      store,
      { email: "ada@example.com", name: "Ada", password },
      now,
    );
    assert.equal(registered.error, true);
    assert.equal(store.users.length, 0);
    const reset = await requestPasswordReset(store, "ada@example.com", now);
    assert.equal(reset.error, true);
    assert.equal(store.resets.length, 0);
  });
});
