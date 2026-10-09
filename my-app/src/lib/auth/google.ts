import { normalizeEmail } from "@/lib/auth/service";
import type { AuthStore, StoredUser } from "@/lib/auth/store";

type AuthEnv = {
  [key: string]: string | undefined;
};

export type GoogleIdentity = {
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export function configuredProviderIds(env: AuthEnv): string[] {
  const ids = ["credentials"];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) ids.push("google");
  return ids;
}

export function isGoogleConfigured(env: AuthEnv = process.env): boolean {
  return configuredProviderIds(env).includes("google");
}

export function googleProviderOptions(
  env: AuthEnv,
): { clientId: string; clientSecret: string } | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

export function readGoogleIdentity(profile: unknown, fallbackEmail?: string | null): GoogleIdentity {
  const record = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
  const email = typeof record.email === "string" ? record.email : (fallbackEmail ?? null);
  const name = typeof record.name === "string" ? record.name : null;
  const verified = record.email_verified;
  return {
    email,
    emailVerified: verified === true || verified === "true",
    name,
  };
}

function displayName(name: string | null, email: string): string {
  const candidate = (name ?? "").trim() || email.split("@")[0] || "Citizen";
  const compact = candidate.replace(/\s+/g, " ").slice(0, 160).trim();
  return compact.length > 0 ? compact : "Citizen";
}

function matchExisting(
  user: StoredUser,
): { ok: true; userId: string; passwordChangedAt: number | null } | { ok: false } {
  if (user.accountStatus !== "ACTIVE" || user.disabledAt !== null || user.emailVerifiedAt === null) {
    return { ok: false };
  }
  return {
    ok: true,
    userId: user.id,
    passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.getTime() : null,
  };
}

export async function authenticateGoogle(
  store: AuthStore,
  identity: GoogleIdentity,
  now: Date,
): Promise<{ ok: true; userId: string; passwordChangedAt: number | null } | { ok: false }> {
  if (!identity.emailVerified) return { ok: false };
  const email = identity.email ? normalizeEmail(identity.email) : null;
  if (!email) return { ok: false };

  const existing = await store.findUserByEmail(email);
  if (existing) return matchExisting(existing);

  const created = await store.createGoogleCitizen({
    email,
    name: displayName(identity.name, email),
    now,
  });
  if (created.status === "created") {
    return { ok: true, userId: created.userId, passwordChangedAt: null };
  }
  if (created.status === "role_missing") return { ok: false };

  const raced = await store.findUserByEmail(email);
  if (!raced) return { ok: false };
  return matchExisting(raced);
}
