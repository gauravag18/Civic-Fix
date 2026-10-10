"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ADMIN_RATE_LIMITED, ADMIN_SAVE_FAILED, ADMIN_SIGN_IN } from "@/lib/admin/messages";
import type { AdminFormState } from "@/lib/admin/actions";
import type { AdminAccess } from "@/lib/admin/types";
import { getAuthorization } from "@/lib/auth/authorization";
import { adminLimiter, rateKey } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import { deleteIssueAsAdmin } from "@/lib/issues/delete-issue";
import { createIssueDeletionStore } from "@/lib/issues/prisma-delete";
import { createIssueImageStore } from "@/lib/issues/supabase-images";
import { isUuid } from "@/lib/issues/validate";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function adminContext(): Promise<{ access: AdminAccess; ipAddress: string | null }> {
  const authorization = await getAuthorization();
  const headerStore = await headers();
  const address = clientAddress(headerStore, trustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
  return {
    access: authorization
      ? { userId: authorization.userId, capabilities: authorization.capabilities }
      : null,
    ipAddress: address === "unknown" ? null : address,
  };
}

export async function deleteIssueAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const issueId = text(formData, "issueId").trim();
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (!adminLimiter.allow(rateKey(["admin", access.userId]), Date.now())) {
      return { message: ADMIN_RATE_LIMITED };
    }
    const result = await deleteIssueAsAdmin(
      access,
      {
        issueId,
        confirmation: text(formData, "confirmation"),
        reason: text(formData, "reason"),
      },
      createIssueDeletionStore(),
      createIssueImageStore(),
      new Date(),
      ipAddress,
    );
    if (result.ok && isUuid(issueId)) redirect(`/admin/issues/${issueId}?done=${result.outcome}`);
    if (!result.ok && result.code === "photos" && isUuid(issueId)) {
      redirect(`/admin/issues/${issueId}?done=retry`);
    }
    if (!result.ok) return { message: result.message };
    return { message: ADMIN_SAVE_FAILED };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Issue deletion failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}
