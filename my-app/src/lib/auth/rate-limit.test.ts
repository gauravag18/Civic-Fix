import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SlidingWindowLimiter, rateKey } from "./rate-limit";

describe("rate limit", () => {
  it("blocks the next attempt after the limit and does not store the raw email", () => {
    const limiter = new SlidingWindowLimiter(2, 1_000);
    const key = rateKey(["login", "203.0.113.5", "ada@example.com"]);
    assert.equal(key.includes("ada@example.com"), false);
    assert.equal(limiter.allow(key, 1_000), true);
    assert.equal(limiter.allow(key, 1_100), true);
    assert.equal(limiter.allow(key, 1_200), false);
    assert.equal(limiter.allow(key, 2_200), true);
  });
});
