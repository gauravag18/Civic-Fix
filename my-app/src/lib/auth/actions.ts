"use server";

import { headers } from "next/headers";
import {
  changeOwnPassword,
  registerAccount,
} from "@/lib/auth/service";
import { createPrismaAuthStore } from "@/lib/auth/prisma-store";
import { getAuthorization } from "@/lib/auth/authorization";
import { RATE_LIMITED } from "@/lib/auth/messages";
import { rateKey, registerLimiter, tokenLimiter } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import type { PublicResult } from "@/lib/auth/service";

async function requestAddress(): Promise<string> {
  const headerStore = await headers();
  return clientAddress(headerStore, trustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
}

function limited(address: string, email: string): boolean {
  return !registerLimiter.allow(rateKey(["register", address, email.toLocaleLowerCase()]), Date.now());
}

export async function registerAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const email = String(formData.get("email") ?? "");
  const address = await requestAddress();
  if (limited(address, email)) {
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

export async function changePasswordAction(
  _previous: PublicResult,
  formData: FormData,
): Promise<PublicResult> {
  const authorization = await getAuthorization();
  if (!authorization) return { error: true, message: "Sign in again before changing the password." };
  const address = await requestAddress();
  if (!tokenLimiter.allow(rateKey(["password", address, authorization.userId]), Date.now())) {
    return { error: true, message: RATE_LIMITED };
  }
  return changeOwnPassword(
    createPrismaAuthStore(),
    authorization.userId,
    {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      nextPassword: String(formData.get("nextPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    },
    new Date(),
  );
}
