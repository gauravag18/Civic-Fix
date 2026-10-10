"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ADMIN_CONFIRM, ADMIN_RATE_LIMITED, ADMIN_SAVE_FAILED, ADMIN_SIGN_IN } from "@/lib/admin/messages";
import { createPrismaAdminStore } from "@/lib/admin/prisma-store";
import {
  addAdminMembership,
  createAdminCategory,
  createAdminDepartment,
  endAdminMembership,
  grantAdminRole,
  revokeAdminRole,
  setAdminAccountStatus,
  setAdminCategoryActive,
  setAdminDepartmentActive,
  updateAdminCategory,
  updateAdminDepartment,
  provisionAdminStaff,
} from "@/lib/admin/service";
import type { AdminAccess } from "@/lib/admin/types";
import { getAuthorization } from "@/lib/auth/authorization";
import { adminLimiter, rateKey } from "@/lib/auth/rate-limit";
import { clientAddress, trustedProxyHops } from "@/lib/auth/request-security";

export type AdminFormState = { message: string };

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

function limited(access: AdminAccess): boolean {
  if (!access) return false;
  return !adminLimiter.allow(rateKey(["admin", access.userId]), Date.now());
}

export async function createDepartmentAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await createAdminDepartment(
      access,
      {
        code: text(formData, "code"),
        name: text(formData, "name"),
        description: text(formData, "description"),
      },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    if (!result.id) return { message: ADMIN_SAVE_FAILED };
    redirect(`/admin/departments/${result.id}`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Department create failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function updateDepartmentAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = text(formData, "id");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await updateAdminDepartment(
      access,
      { id, name: text(formData, "name"), description: text(formData, "description") },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/departments/${id}?saved=details`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Department update failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function setDepartmentActiveAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = text(formData, "id");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    if (text(formData, "isActive") === "false" && text(formData, "confirm") !== "yes") {
      return { message: ADMIN_CONFIRM };
    }
    const result = await setAdminDepartmentActive(
      access,
      { id, isActive: text(formData, "isActive") === "true" },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/departments/${id}?saved=status`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Department status change failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function addMembershipAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const departmentId = text(formData, "departmentId");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await addAdminMembership(
      access,
      { departmentId, userId: text(formData, "userId") },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/departments/${departmentId}?saved=membership`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Membership create failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function endMembershipAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const departmentId = text(formData, "departmentId");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    if (text(formData, "confirm") !== "yes") return { message: ADMIN_CONFIRM };
    const result = await endAdminMembership(
      access,
      text(formData, "membershipId"),
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/departments/${departmentId}?saved=membership`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Membership end failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function createCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await createAdminCategory(
      access,
      {
        code: text(formData, "code"),
        name: text(formData, "name"),
        sortOrder: text(formData, "sortOrder"),
      },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    if (!result.id) return { message: ADMIN_SAVE_FAILED };
    redirect(`/admin/categories/${result.id}`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Category create failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function updateCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = text(formData, "id");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await updateAdminCategory(
      access,
      { id, name: text(formData, "name"), sortOrder: text(formData, "sortOrder") },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/categories/${id}?saved=details`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Category update failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function setCategoryActiveAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = text(formData, "id");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await setAdminCategoryActive(
      access,
      { id, isActive: text(formData, "isActive") === "true" },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/categories/${id}?saved=status`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Category status change failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function setAccountStatusAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const userId = text(formData, "userId");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    if (text(formData, "confirm") !== "yes") return { message: ADMIN_CONFIRM };
    const result = await setAdminAccountStatus(
      access,
      { userId, status: text(formData, "status") },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/users/${userId}?saved=status`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Account status change failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function grantRoleAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const userId = text(formData, "userId");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await grantAdminRole(
      access,
      { userId, role: text(formData, "role") },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/users/${userId}?saved=role`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Role grant failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function revokeRoleAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const userId = text(formData, "userId");
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    if (text(formData, "confirm") !== "yes") return { message: ADMIN_CONFIRM };
    const result = await revokeAdminRole(
      access,
      { userId, role: text(formData, "role") },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    redirect(`/admin/users/${userId}?saved=role`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Role revoke failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}

export async function provisionStaffAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const { access, ipAddress } = await adminContext();
    if (!access) return { message: ADMIN_SIGN_IN };
    if (limited(access)) return { message: ADMIN_RATE_LIMITED };
    const result = await provisionAdminStaff(
      access,
      {
        name: text(formData, "name"),
        email: text(formData, "email"),
        password: text(formData, "password"),
        confirmPassword: text(formData, "confirmPassword"),
        departmentId: text(formData, "departmentId"),
        confirm: text(formData, "confirm"),
      },
      createPrismaAdminStore(),
      new Date(),
      ipAddress,
    );
    if (!result.ok) return { message: result.message };
    if (!result.id) return { message: ADMIN_SAVE_FAILED };
    redirect(`/admin/users/${result.id}?provisioned=1`);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Staff provision failed.");
    return { message: ADMIN_SAVE_FAILED };
  }
}
