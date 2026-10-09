type HeaderSource =
  | { get(name: string): string | null }
  | Record<string, unknown>
  | undefined;

function readHeader(headers: HeaderSource, name: string): string {
  if (!headers || typeof headers !== "object") return "";
  if ("get" in headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" ? value : "";
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function isIp(value: string): boolean {
  const address = value.replace(/^\[|\]$/g, "");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) {
    return address.split(".").every((part) => Number(part) <= 255);
  }
  return address.includes(":") && /^[0-9a-fA-F:]+$/.test(address) && address.length <= 45;
}

export function trustedProxyHops(value: string | undefined): number {
  const hops = Number(value ?? "1");
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) return 1;
  return hops;
}

export function clientAddress(headers: HeaderSource, trustedHops = 1): string {
  const forwarded = readHeader(headers, "x-forwarded-for")
    .split(",")
    .map((part) => part.trim())
    .filter(isIp);
  if (forwarded.length > 0 && trustedHops > 0) {
    const index = forwarded.length - trustedHops;
    if (index >= 0) return forwarded[index] ?? "unknown";
  }
  const realIp = readHeader(headers, "x-real-ip").trim();
  if (isIp(realIp)) return realIp;
  return "unknown";
}

export function secureSessionCookies(authUrl: string | undefined): boolean {
  return typeof authUrl === "string" && authUrl.startsWith("https://");
}

export function sessionCookiePolicy(secure: boolean): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
} {
  return { httpOnly: true, sameSite: "lax", path: "/", secure };
}

export function safeCallbackUrl(url: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return "/";
  }
  const candidate = url.trim();
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\") &&
    !candidate.includes("\n") &&
    !candidate.includes("\r")
  ) {
    return `${base.origin}${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.origin !== base.origin || parsed.username || parsed.password) return base.origin;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return base.origin;
    return parsed.toString();
  } catch {
    return base.origin;
  }
}
