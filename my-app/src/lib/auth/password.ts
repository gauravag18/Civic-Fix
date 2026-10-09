import { hash, verify, type Options } from "@node-rs/argon2";

const OPTIONS: Options = {
  // 2 is Argon2id. The const enum cannot be imported when isolatedModules is enabled.
  algorithm: 2, // Argon2id. The package exposes this as a const enum, which isolatedModules cannot import.
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function validatePassword(
  password: string,
  email: string,
  name: string,
): string | null {
  if (password.length < 12 || password.length > 128) {
    return "Use a password between 12 and 128 characters.";
  }
  const lowered = password.toLocaleLowerCase();
  if (lowered === email.toLocaleLowerCase() || lowered === name.toLocaleLowerCase()) {
    return "Use a password that is not your email or name.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    return false;
  }
}
