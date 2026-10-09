import "server-only";

import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  authenticateGoogle,
  googleProviderOptions,
  readGoogleIdentity,
} from "@/lib/auth/google";
import { createPrismaAuthStore } from "@/lib/auth/prisma-store";
import { authenticate } from "@/lib/auth/service";
import { loginLimiter, rateKey } from "@/lib/auth/rate-limit";
import { InactiveSessionError, assessToken } from "@/lib/auth/store";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/tokens";

function headerValue(headers: unknown, name: string): string {
  if (!headers || typeof headers !== "object") return "unknown";
  if ("get" in headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" && value ? value : "unknown";
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "unknown";
  return typeof value === "string" && value ? value : "unknown";
}

function authSecret(): string | undefined {
  const value = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  return value || undefined;
}

function rejectInactive(error: unknown): never {
  if (error instanceof InactiveSessionError) throw error;
  throw new InactiveSessionError();
}

const google = googleProviderOptions(process.env);

export const authOptions: NextAuthOptions = {
  secret: authSecret(),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  // Google is registered only when both server credentials exist.
  // Linking is decided in authenticateGoogle, and only for a verified CivicFix email.
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const forwarded = headerValue(request?.headers, "x-forwarded-for").split(",")[0]?.trim();
        const key = rateKey(["login", forwarded || "unknown", email.toLocaleLowerCase()]);
        if (!loginLimiter.allow(key, Date.now())) return null;
        const result = await authenticate(createPrismaAuthStore(), email, password);
        if (!result.ok) return null;
        return {
          id: result.userId,
          passwordChangedAt: result.passwordChangedAt,
        };
      },
    }),
    ...(google
      ? [Google({ clientId: google.clientId, clientSecret: google.clientSecret })]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return true;
      try {
        const identity = readGoogleIdentity(profile, user.email);
        const result = await authenticateGoogle(createPrismaAuthStore(), identity, new Date());
        return result.ok;
      } catch {
        return false;
      }
    },
    async jwt({ token, user, account, profile }) {
      try {
        if (account?.provider === "google") {
          const identity = readGoogleIdentity(profile, user?.email);
          const result = await authenticateGoogle(createPrismaAuthStore(), identity, new Date());
          if (!result.ok) throw new InactiveSessionError();
          token.sub = result.userId;
          token.authProvider = "google";
          if (result.passwordChangedAt === null) delete token.pwdAt;
          else token.pwdAt = result.passwordChangedAt;
        } else if (user) {
          token.sub = user.id;
          token.pwdAt = user.passwordChangedAt;
          token.authProvider = "credentials";
        }
        if (!token.sub) throw new InactiveSessionError();
        const record = await createPrismaAuthStore().findUserById(token.sub);
        const provider = token.authProvider === "google" ? "google" : "credentials";
        if (assessToken(record, token.pwdAt, provider) !== "ok") {
          throw new InactiveSessionError();
        }
        return token;
      } catch (error) {
        return rejectInactive(error);
      }
    },
    async session({ session, token }) {
      if (!token.sub) throw new InactiveSessionError();
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
        },
      };
    },
  },
};
