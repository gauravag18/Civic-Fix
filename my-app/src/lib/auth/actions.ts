"use server";

import { headers } from "next/headers";
import {
  registerAccount,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  verifyEmail,
} from "@/lib/auth/service";
import { createPrismaAuthStore } from "@/lib/auth/prisma-store";
import { RATE_LIMITED } from "@/lib/auth/messages";
import { rateKey, registerLimiter, tokenLimiter } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import type { PublicResult } from "@/lib/auth/service";

async function requestAddress(): Promise<string> {
  const headerStore = await headers();
  return clientAddress(headerStore, trustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
}

function limited(kind: string, address: string, email: string): boolean {
  const limiter = kind === "register" ? registerLimiter : tokenLimiter;
  return !limiter.allow(rateKey([kind, address, email.toLocaleLowerCase()]), Date.now());
}

export async function registerAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const email = String(formData.get("email") ?? "");
  const address = await requestAddress();
  if (limited("register", address, email)) {
    return { error: true, message: RATE_LIMITED };
  }
  return registerAccount(
    createPrismaAuthStore(),
    {
      email,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    new Date(),
  );
}

export async function requestVerificationAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const email = String(formData.get("email") ?? "");
  const address = await requestAddress();
  if (limited("verify-request", address, email)) {
    return { error: true, message: RATE_LIMITED };
  }
  return requestVerification(createPrismaAuthStore(), email, new Date());
}

export async function verifyEmailAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const token = String(formData.get("token") ?? "");
  const address = await requestAddress();
  if (limited("verify", address, "token")) {
    return { error: true, message: RATE_LIMITED };
  }
  return verifyEmail(createPrismaAuthStore(), token, new Date());
}

export async function requestResetAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const email = String(formData.get("email") ?? "");
  const address = await requestAddress();
  if (limited("reset-request", address, email)) {
    return { error: true, message: RATE_LIMITED };
  }
  return requestPasswordReset(createPrismaAuthStore(), email, new Date());
}

export async function resetPasswordAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const address = await requestAddress();
  if (limited("reset", address, "token")) {
    return { error: true, message: RATE_LIMITED };
  }
  return resetPassword(
    createPrismaAuthStore(),
    {
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    new Date(),
  );
}
