import "server-only";

import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createPrismaAuthStore } from "@/lib/auth/prisma-store";
import { authorizationForSession } from "@/lib/auth/service";

// Protected server reads must use this helper. A session cookie by itself is not access.
export const getAuthorization = cache(async function getAuthorization(untrustedDepartmentId?: string) {
  try {
    const session = await getServerSession(authOptions);
    return await authorizationForSession(
      createPrismaAuthStore(),
      session,
      untrustedDepartmentId,
    );
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
});
