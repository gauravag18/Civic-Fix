import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("password policy", () => {
  it("rejects short passwords and passwords that match identity", () => {
    assert.equal(validatePassword("short-pass", "a@b.co", "Ada"), "Use a password between 12 and 128 characters.");
    assert.equal(
      validatePassword("ada@example.com", "ada@example.com", "Ada"),
      "Use a password that is not your email or name.",
    );
    assert.equal(validatePassword("a-long-enough-passphrase", "ada@example.com", "Ada"), null);
  });

  it("stores an Argon2id PHC hash that verifies only the same password", async () => {
    const password = "a-long-enough-passphrase";
    const stored = await hashPassword(password);
    assert.equal(stored.startsWith("$argon2id$"), true);
    assert.equal(await verifyPassword(password, stored), true);
    assert.equal(await verifyPassword("different-passphrase", stored), false);
    assert.equal(await verifyPassword(password, "not-a-hash"), false);
  });
});
