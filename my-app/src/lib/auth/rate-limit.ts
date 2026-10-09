import { createHash } from "node:crypto";

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now: number): boolean {
    const start = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((stamp) => stamp > start);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export function rateKey(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

const WINDOW_MS = 15 * 60 * 1000;

export const loginLimiter = new SlidingWindowLimiter(8, WINDOW_MS);
export const registerLimiter = new SlidingWindowLimiter(5, WINDOW_MS);
export const tokenLimiter = new SlidingWindowLimiter(8, WINDOW_MS);
export const issueReportLimiter = new SlidingWindowLimiter(8, WINDOW_MS);
