import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isEmailConfigured } from "./email";

const KEYS = [
  "EMAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "APP_ORIGIN",
] as const;

describe("email configuration", () => {
  const previous = new Map<string, string | undefined>();

  afterEach(() => {
    for (const key of KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
  });

  it("is not configured when the SMTP values are absent", () => {
    for (const key of KEYS) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
    assert.equal(isEmailConfigured(), false);
  });

  it("is configured only when every delivery value is present", () => {
    for (const key of KEYS) previous.set(key, process.env[key]);
    process.env.EMAIL_FROM = "CivicFix <civicfix@example.com>";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "civicfix";
    process.env.SMTP_PASSWORD = "secret";
    process.env.APP_ORIGIN = "http://localhost:3000";
    assert.equal(isEmailConfigured(), true);
    delete process.env.APP_ORIGIN;
    assert.equal(isEmailConfigured(), false);
  });
});
