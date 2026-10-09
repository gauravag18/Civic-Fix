"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { getAuthorization } from "@/lib/auth/authorization";
import { departmentLimiter } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";
import { STAFF_RATE_LIMITED, STAFF_SAVE_FAILED, STAFF_SIGN_IN } from "@/lib/issues/messages";
import { createPrismaDepartmentStore } from "@/lib/issues/prisma-department";
import {
  assignDepartmentIssue,
  changeDepartmentStatus,
  claimDepartmentUpdate,
  commentOnDepartmentIssue,
  type DepartmentAccess,
} from "@/lib/issues/staff-service";

export type DepartmentFormState = { message: string };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function staffContext(): Promise<{
  access: DepartmentAccess;
  ipAddress: string | null;
}> {
  const authorization = await getAuthorization();
  const headerStore = await headers();
  const address = clientAddress(headerStore, trustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
  return {
    access: authorization
      ? {
          userId: authorization.userId,
          departmentId: authorization.departmentId,
          capabilities: authorization.capabilities,
        }
      : null,
    ipAddress: address === "unknown" ? null : address,
  };
}

function limited(access: DepartmentAccess): boolean {
  if (!access) return false;
  return !claimDepartmentUpdate(departmentLimiter, access.userId, Date.now());
}

export async function assignIssueAction(
  _previous: DepartmentFormState,
  formData: FormData,
): Promise<DepartmentFormState> {
  const issueId = text(formData, "issueId");
  try {
    const { access, ipAddress } = await staffContext();
    if (!access) return { message: STAFF_SIGN_IN };
    if (limited(access)) return { message: STAFF_RATE_LIMITED };
    const result = await assignDepartmentIssue(
      access,
      {
        issueId,
        assigneeId: text(formData, "assigneeId"),
        note: text(formData, "note"),
      },
      createPrismaDepartmentStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/department/issues/${issueId}?updated=assignment`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Department assignment failed.");
    return { message: STAFF_SAVE_FAILED };
  }
}

export async function changeStatusAction(
  _previous: DepartmentFormState,
  formData: FormData,
): Promise<DepartmentFormState> {
  const issueId = text(formData, "issueId");
  try {
    const { access, ipAddress } = await staffContext();
    if (!access) return { message: STAFF_SIGN_IN };
    if (limited(access)) return { message: STAFF_RATE_LIMITED };
    const result = await changeDepartmentStatus(
      access,
      {
        issueId,
        toStatus: text(formData, "toStatus"),
        reason: text(formData, "reason"),
      },
      createPrismaDepartmentStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/department/issues/${issueId}?updated=status`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Department status change failed.");
    return { message: STAFF_SAVE_FAILED };
  }
}

export async function commentAction(
  _previous: DepartmentFormState,
  formData: FormData,
): Promise<DepartmentFormState> {
  const issueId = text(formData, "issueId");
  try {
    const { access, ipAddress } = await staffContext();
    if (!access) return { message: STAFF_SIGN_IN };
    if (limited(access)) return { message: STAFF_RATE_LIMITED };
    const result = await commentOnDepartmentIssue(
      access,
      { issueId, body: text(formData, "body") },
      createPrismaDepartmentStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/department/issues/${issueId}?updated=comment`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Department comment failed.");
    return { message: STAFF_SAVE_FAILED };
  }
}
