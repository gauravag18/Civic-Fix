import "server-only";

import { getAuthorization } from "@/lib/auth/authorization";
import { createPrismaAnalyticsStore } from "@/lib/analytics/prisma-analytics";
import {
  loadAdminAnalytics,
  loadDepartmentAnalytics,
  type AdminAnalyticsResult,
  type DepartmentAnalyticsResult,
} from "@/lib/analytics/service";
import type { AnalyticsQuery } from "@/lib/analytics/metrics";

export async function loadAdminAnalyticsPage(query: AnalyticsQuery): Promise<AdminAnalyticsResult> {
  try {
    const authorization = await getAuthorization();
    const access = authorization
      ? { userId: authorization.userId, capabilities: authorization.capabilities }
      : null;
    return await loadAdminAnalytics(access, query, createPrismaAnalyticsStore());
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function loadDepartmentAnalyticsPage(
  query: AnalyticsQuery,
): Promise<DepartmentAnalyticsResult> {
  try {
    const authorization = await getAuthorization();
    const access = authorization
      ? {
          userId: authorization.userId,
          departmentId: authorization.departmentId,
          capabilities: authorization.capabilities,
          mustChangePassword: authorization.mustChangePassword,
        }
      : null;
    return await loadDepartmentAnalytics(access, query, createPrismaAnalyticsStore());
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
