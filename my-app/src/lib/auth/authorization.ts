import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createPrismaAuthStore } from "@/lib/auth/prisma-store";
import { authorizationForSession } from "@/lib/auth/service";

// Protected server reads must use this helper. A session cookie by itself is not access.
export async function getAuthorization(untrustedDepartmentId?: string) {
  try {
    const session = await getServerSession(authOptions);
    return await authorizationForSession(
      createPrismaAuthStore(),
      session,
      untrustedDepartmentId,
    );
  } catch {
    return null;
  }
}
