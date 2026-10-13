"use server";

import { getAuthorization } from "@/lib/auth/authorization";
import { homePath } from "@/lib/auth/home-path";

export async function homeAfterSignIn(): Promise<string> {
  return homePath(await getAuthorization());
}
