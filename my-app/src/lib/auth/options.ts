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
import {
  clientAddress,
  safeCallbackUrl,
  secureSessionCookies,
  sessionCookiePolicy,
  trustedProxyHops,
} from "@/lib/auth/request-security";
import { InactiveSessionError, assessToken } from "@/lib/auth/store";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/tokens";

function authSecret(): string | undefined {
  const value = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  return value || undefined;
}

function rejectInactive(error: unknown): never {
  if (error instanceof InactiveSessionError) throw error;
  throw new InactiveSessionError();
}

const google = googleProviderOptions(process.env);
const secureCookies = secureSessionCookies(process.env.NEXTAUTH_URL);
const cookieOptions = sessionCookiePolicy(secureCookies);

export const authOptions: NextAuthOptions = {
  secret: authSecret(),
  useSecureCookies: secureCookies,
  // JWT sessions last 12 hours. Sign-out deletes only this browser's cookie.
  // A copied token for an account that is still active cannot be revoked
  // without new session storage. Disablement, suspension, and a password
  // change are rejected on the next session check, and that check clears the
  // cookie.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  cookies: {
    sessionToken: {
      name: `${secureCookies ? "__Secure-" : ""}next-auth.session-token`,
      options: cookieOptions,
    },
    callbackUrl: {
      name: `${secureCookies ? "__Secure-" : ""}next-auth.callback-url`,
      options: cookieOptions,
    },
    csrfToken: {
      name: `${secureCookies ? "__Host-" : ""}next-auth.csrf-token`,
      options: cookieOptions,
    },
  },
  // Google is registered only when both server credentials exist.
  // Linking is decided in authenticateGoogle, and only when Google reports
  // the address as verified and the CivicFix account is active.
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
        const address = clientAddress(request?.headers, trustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
        const key = rateKey(["login", address, email.toLocaleLowerCase()]);
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
    async redirect({ url, baseUrl }) {
      return safeCallbackUrl(url, baseUrl);
    },
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
        expires: session.expires,
        user: { id: token.sub },
      };
    },
  },
};
