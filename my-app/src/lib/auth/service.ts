import { capabilitiesFor } from "@/lib/auth/capabilities";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  EMAIL_NOT_CONFIGURED,
  LOGIN_FAILURE,
  RATE_LIMITED,
  REGISTER_NEUTRAL,
  REGISTRATION_UNAVAILABLE,
  RESET_NEUTRAL,
  TOKEN_INVALID,
} from "@/lib/auth/messages";
import { isRoleCode } from "@/lib/auth/roles";
import { assessToken, isEligible, mustReplaceProvisionedPassword, sessionUserId, type AuthStore } from "@/lib/auth/store";
import {
  RESET_TTL_MS,
  VERIFICATION_TTL_MS,
  hashSecretToken,
  newSecretToken,
} from "@/lib/auth/tokens";
import {
  isEmailConfigured,
  resetMessage,
  sendAuthEmail,
  verificationMessage,
} from "@/lib/auth/email";

export type PublicResult = { error: boolean; message: string };

export type MailSender = (input: {
  to: string;
  subject: string;
  text: string;
}) => Promise<"sent" | "not_configured" | "failed">;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLocaleLowerCase();
  if (email.length < 3 || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}

export function normalizeName(value: string): string | null {
  const name = value.trim();
  if (name.length < 1 || name.length > 160) return null;
  return name;
}

let dummyHash: Promise<string> | null = null;

function timingPad(): Promise<string> {
  dummyHash ??= hashPassword("civicfix-timing-pad");
  return dummyHash;
}

export async function authenticate(
  store: AuthStore,
  email: string,
  password: string,
): Promise<{ ok: true; userId: string; passwordChangedAt: number } | { ok: false }> {
  const normalized = normalizeEmail(email);
  const record = normalized ? await store.findUserByEmail(normalized) : null;
  const passwordHash = record?.passwordHash ?? (await timingPad());
  const matches = password.length > 0 && (await verifyPassword(password, passwordHash));
  if (!record || !matches || !isEligible(record) || record.passwordChangedAt === null) {
    return { ok: false };
  }
  return {
    ok: true,
    userId: record.id,
    passwordChangedAt: record.passwordChangedAt.getTime(),
  };
}

export { assessToken };

async function deliver(
  send: MailSender,
  input: { to: string; subject: string; text: string },
): Promise<void> {
  const result = await send(input);
  if (result === "failed") console.error("Auth email could not be sent.");
}

export async function registerAccount(
  store: AuthStore,
  input: { email: string; name: string; password: string },
  now: Date,
  send: MailSender = sendAuthEmail,
): Promise<PublicResult> {
  if (!isEmailConfigured()) {
    return { error: true, message: EMAIL_NOT_CONFIGURED };
  }
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);
  if (!email || !name) {
    return { error: true, message: "Enter your name and a valid email address." };
  }
  const passwordError = validatePassword(input.password, email, name);
  if (passwordError) return { error: true, message: passwordError };

  const passwordHash = await hashPassword(input.password);
  const token = newSecretToken();
  const result = await store.registerCitizen({
    email,
    name,
    passwordHash,
    verificationTokenHash: token.hash,
    verificationExpiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    now,
  });
  if (result === "role_missing") {
    return { error: true, message: REGISTRATION_UNAVAILABLE };
  }
  if (result === "created") {
    const origin = process.env.APP_ORIGIN ?? "";
    await deliver(send, {
      to: email,
      subject: "Confirm your CivicFix email",
      text: verificationMessage(origin, token.raw),
    });
  }
  return { error: false, message: REGISTER_NEUTRAL };
}

export async function requestVerification(
  store: AuthStore,
  emailInput: string,
  now: Date,
  send: MailSender = sendAuthEmail,
): Promise<PublicResult> {
  if (!isEmailConfigured()) {
    return { error: true, message: EMAIL_NOT_CONFIGURED };
  }
  const email = normalizeEmail(emailInput);
  if (!email) return { error: true, message: "Enter a valid email address." };
  const token = newSecretToken();
  const result = await store.issueVerificationToken({
    email,
    tokenHash: token.hash,
    expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    now,
  });
  if (result === "issued") {
    const origin = process.env.APP_ORIGIN ?? "";
    await deliver(send, {
      to: email,
      subject: "Confirm your CivicFix email",
      text: verificationMessage(origin, token.raw),
    });
  }
  return { error: false, message: REGISTER_NEUTRAL };
}

export async function verifyEmail(
  store: AuthStore,
  rawToken: string,
  now: Date,
): Promise<PublicResult> {
  if (!rawToken) return { error: true, message: TOKEN_INVALID };
  const result = await store.consumeVerificationToken(hashSecretToken(rawToken), now);
  if (result !== "verified") return { error: true, message: TOKEN_INVALID };
  return { error: false, message: "Email confirmed. You can log in." };
}

export async function requestPasswordReset(
  store: AuthStore,
  emailInput: string,
  now: Date,
  send: MailSender = sendAuthEmail,
): Promise<PublicResult> {
  if (!isEmailConfigured()) {
    return { error: true, message: EMAIL_NOT_CONFIGURED };
  }
  const email = normalizeEmail(emailInput);
  if (!email) return { error: true, message: "Enter a valid email address." };
  const token = newSecretToken();
  const result = await store.issueResetToken({
    email,
    tokenHash: token.hash,
    expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    now,
  });
  if (result === "issued") {
    const origin = process.env.APP_ORIGIN ?? "";
    await deliver(send, {
      to: email,
      subject: "Reset your CivicFix password",
      text: resetMessage(origin, token.raw),
    });
  }
  return { error: false, message: RESET_NEUTRAL };
}

export async function resetPassword(
  store: AuthStore,
  input: { token: string; password: string },
  now: Date,
): Promise<PublicResult> {
  if (!input.token) return { error: true, message: TOKEN_INVALID };
  const tokenHash = hashSecretToken(input.token);
  const account = await store.findResetAccount(tokenHash, now);
  if (!account) return { error: true, message: TOKEN_INVALID };
  const passwordError = validatePassword(input.password, account.email, account.name);
  if (passwordError) return { error: true, message: passwordError };
  const passwordHash = await hashPassword(input.password);
  const result = await store.consumeResetToken({
    tokenHash,
    passwordHash,
    now,
  });
  if (result !== "reset") return { error: true, message: TOKEN_INVALID };
  return { error: false, message: "Password updated. Log in with the new password." };
}

export async function authorizationForSession(
  store: AuthStore,
  session: { user?: { id?: string | null } | null } | null | undefined,
  untrustedDepartmentId?: string,
) {
  const userId = sessionUserId(session);
  if (!userId) return null;
  return authorizationFor(store, userId, untrustedDepartmentId);
}

export async function authorizationFor(
  store: AuthStore,
  userId: string,
  untrustedDepartmentId?: string,
): Promise<{
  userId: string;
  name: string;
  email: string;
  roleCodes: string[];
  departmentId: string | null;
  capabilities: ReadonlySet<string>;
  mustChangePassword: boolean;
} | null> {
  void untrustedDepartmentId;
  const user = await store.findUserById(userId);
  if (!user || !isEligible(user)) return null;
  const roleCodes = await store.activeRoleCodes(userId);
  const departmentId = await store.activeDepartmentId(userId);
  return {
    userId,
    name: user.name,
    email: user.email,
    roleCodes,
    departmentId,
    capabilities: capabilitiesFor(roleCodes, departmentId),
    mustChangePassword: mustReplaceProvisionedPassword(user),
  };
}

export async function grantRole(
  store: AuthStore,
  input: { actorUserId: string; targetUserId: string; roleCode: string; now: Date },
): Promise<"granted" | "forbidden" | "self" | "missing_role" | "missing_user" | "already_active"> {
  if (!isRoleCode(input.roleCode)) return "missing_role";
  return store.grantRole(input);
}

export async function disableAccount(
  store: AuthStore,
  input: { actorUserId: string; targetUserId: string; now: Date },
): Promise<"disabled" | "forbidden" | "self" | "missing"> {
  return store.disableAccount(input);
}

export async function changeOwnPassword(
  store: AuthStore,
  userId: string,
  input: { currentPassword: string; nextPassword: string; confirmPassword: string },
  now: Date,
): Promise<PublicResult> {
  const user = await store.findUserById(userId);
  if (!user || !isEligible(user) || !user.passwordHash) {
    return { error: true, message: "Sign in again before changing the password." };
  }
  const currentMatches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentMatches) return { error: true, message: "The current password is incorrect." };
  if (input.nextPassword !== input.confirmPassword) {
    return { error: true, message: "Enter the same new password in both fields." };
  }
  const passwordError = validatePassword(input.nextPassword, user.email, user.name);
  if (passwordError) return { error: true, message: passwordError };
  if (await verifyPassword(input.nextPassword, user.passwordHash)) {
    return { error: true, message: "Choose a password that is different from the current one." };
  }
  const passwordHash = await hashPassword(input.nextPassword);
  const changed = await store.changePassword({ userId, passwordHash, now });
  if (changed !== "changed") {
    return { error: true, message: "The password could not be saved. Try again." };
  }
  return {
    error: false,
    message: "Password updated. Sign in again with the new password.",
  };
}

export { RATE_LIMITED, LOGIN_FAILURE };
