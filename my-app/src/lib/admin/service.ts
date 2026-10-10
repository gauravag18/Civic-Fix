import { Capability, hasCapability } from "@/lib/auth/capabilities";
import type { AccountStatus } from "@/generated/prisma/enums";
import {
  ADMIN_DEPARTMENT_BLOCKED,
  ADMIN_DUPLICATE,
  ADMIN_FORBIDDEN,
  ADMIN_INVALID,
  ADMIN_LAST,
  ADMIN_MEMBERSHIP_BLOCKED,
  ADMIN_MISSING,
  ADMIN_ROLE,
  ADMIN_SAVE_FAILED,
  ADMIN_SELF,
  ADMIN_SIGN_IN,
} from "@/lib/admin/messages";
import {
  normalizeCode,
  normalizeLabel,
  normalizeOptional,
  normalizeSearch,
  normalizeSortOrder,
  roleFromForm,
} from "@/lib/admin/rules";
import type { AdminStore, AdminWriteResult } from "@/lib/admin/store";
import { ADMIN_PAGE_SIZE, type AdminAccess, type AdminResult } from "@/lib/admin/types";
import { isUuid } from "@/lib/issues/validate";
import { pageNumber } from "@/lib/issues/service";

export function requireAdmin(
  access: AdminAccess,
): { ok: true; userId: string } | { ok: false; reason: "signed-out" | "forbidden" } {
  if (!access) return { ok: false, reason: "signed-out" };
  if (
    !hasCapability(access.capabilities, Capability.roleGrant) ||
    !hasCapability(access.capabilities, Capability.accountDisable)
  ) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, userId: access.userId };
}

function denied(reason: "signed-out" | "forbidden"): AdminResult {
  return { ok: false, message: reason === "signed-out" ? ADMIN_SIGN_IN : ADMIN_FORBIDDEN };
}

function fromWrite(result: AdminWriteResult): AdminResult {
  if (result.ok) return { ok: true };
  if (result.reason === "duplicate") return { ok: false, message: ADMIN_DUPLICATE };
  if (result.reason === "invalid") return { ok: false, message: ADMIN_INVALID };
  if (result.reason === "missing") return { ok: false, message: ADMIN_MISSING };
  if (result.reason === "blocked") return { ok: false, message: ADMIN_DEPARTMENT_BLOCKED };
  if (result.reason === "membership") return { ok: false, message: ADMIN_MEMBERSHIP_BLOCKED };
  if (result.reason === "self") return { ok: false, message: ADMIN_SELF };
  if (result.reason === "last_admin") return { ok: false, message: ADMIN_LAST };
  if (result.reason === "role") return { ok: false, message: ADMIN_ROLE };
  return { ok: false, message: ADMIN_SAVE_FAILED };
}

async function guard<T>(
  access: AdminAccess,
  work: (actorId: string) => Promise<T>,
): Promise<T | { ok: false; reason: "signed-out" | "forbidden" | "unavailable" }> {
  const admin = requireAdmin(access);
  if (!admin.ok) return admin;
  try {
    return await work(admin.userId);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function loadDashboard(access: AdminAccess, store: AdminStore) {
  const result = await guard(access, async () => ({ ok: true as const, counts: await store.counts() }));
  if ("reason" in result && result.reason === "unavailable") {
    return { ok: false as const, reason: "unavailable" as const };
  }
  return result;
}

export async function loadDepartments(
  access: AdminAccess,
  query: string,
  requestedPage: unknown,
  store: AdminStore,
) {
  return guard(access, async () => {
    const page = pageNumber(requestedPage);
    const found = await store.searchDepartments(normalizeSearch(query), page, ADMIN_PAGE_SIZE);
    return { ok: true as const, page, pageSize: ADMIN_PAGE_SIZE, ...found };
  });
}

export async function loadDepartment(access: AdminAccess, id: string, store: AdminStore) {
  return guard(access, async () => {
    if (!isUuid(id)) return { ok: false as const, reason: "missing" as const };
    const department = await store.getDepartment(id);
    if (!department) return { ok: false as const, reason: "missing" as const };
    const staff = await store.eligibleStaff(id);
    return { ok: true as const, department, staff };
  });
}

export async function createAdminDepartment(
  access: AdminAccess,
  raw: { code: string; name: string; description: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult & { id?: string }> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  const code = normalizeCode(raw.code);
  const name = normalizeLabel(raw.name, 160);
  const description = normalizeOptional(raw.description, 500);
  if (!code || !name || description === "invalid") return { ok: false, message: ADMIN_INVALID };
  try {
    const written = await store.createDepartment({
      actorId: admin.userId,
      code,
      name,
      description,
      now,
      ipAddress,
    });
    if (!written.ok) return fromWrite(written);
    return { ok: true, id: written.id };
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function updateAdminDepartment(
  access: AdminAccess,
  raw: { id: string; name: string; description: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  const name = normalizeLabel(raw.name, 160);
  const description = normalizeOptional(raw.description, 500);
  if (!isUuid(raw.id) || !name || description === "invalid") return { ok: false, message: ADMIN_INVALID };
  try {
    return fromWrite(
      await store.updateDepartment({
        actorId: admin.userId,
        id: raw.id,
        name,
        description,
        now,
        ipAddress,
      }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function setAdminDepartmentActive(
  access: AdminAccess,
  raw: { id: string; isActive: boolean },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  if (!isUuid(raw.id)) return { ok: false, message: ADMIN_MISSING };
  try {
    return fromWrite(
      await store.setDepartmentActive({
        actorId: admin.userId,
        id: raw.id,
        isActive: raw.isActive,
        now,
        ipAddress,
      }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function addAdminMembership(
  access: AdminAccess,
  raw: { departmentId: string; userId: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  if (!isUuid(raw.departmentId) || !isUuid(raw.userId)) {
    return { ok: false, message: ADMIN_MEMBERSHIP_BLOCKED };
  }
  try {
    return fromWrite(
      await store.addMembership({
        actorId: admin.userId,
        departmentId: raw.departmentId,
        userId: raw.userId,
        now,
        ipAddress,
      }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function endAdminMembership(
  access: AdminAccess,
  membershipId: string,
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  if (!isUuid(membershipId)) return { ok: false, message: ADMIN_MISSING };
  try {
    return fromWrite(
      await store.endMembership({ actorId: admin.userId, membershipId, now, ipAddress }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function loadCategories(
  access: AdminAccess,
  query: string,
  requestedPage: unknown,
  store: AdminStore,
) {
  return guard(access, async () => {
    const page = pageNumber(requestedPage);
    const found = await store.searchCategories(normalizeSearch(query), page, ADMIN_PAGE_SIZE);
    return { ok: true as const, page, pageSize: ADMIN_PAGE_SIZE, ...found };
  });
}

export async function loadCategory(access: AdminAccess, id: string, store: AdminStore) {
  return guard(access, async () => {
    if (!isUuid(id)) return { ok: false as const, reason: "missing" as const };
    const category = await store.getCategory(id);
    if (!category) return { ok: false as const, reason: "missing" as const };
    return { ok: true as const, category };
  });
}

export async function createAdminCategory(
  access: AdminAccess,
  raw: { code: string; name: string; sortOrder: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult & { id?: string }> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  const code = normalizeCode(raw.code);
  const name = normalizeLabel(raw.name, 160);
  const sortOrder = normalizeSortOrder(raw.sortOrder);
  if (!code || !name || sortOrder === null) return { ok: false, message: ADMIN_INVALID };
  try {
    const written = await store.createCategory({
      actorId: admin.userId,
      code,
      name,
      sortOrder,
      now,
      ipAddress,
    });
    if (!written.ok) return fromWrite(written);
    return { ok: true, id: written.id };
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function updateAdminCategory(
  access: AdminAccess,
  raw: { id: string; name: string; sortOrder: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  const name = normalizeLabel(raw.name, 160);
  const sortOrder = normalizeSortOrder(raw.sortOrder);
  if (!isUuid(raw.id) || !name || sortOrder === null) return { ok: false, message: ADMIN_INVALID };
  try {
    return fromWrite(
      await store.updateCategory({
        actorId: admin.userId,
        id: raw.id,
        name,
        sortOrder,
        now,
        ipAddress,
      }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function setAdminCategoryActive(
  access: AdminAccess,
  raw: { id: string; isActive: boolean },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  if (!isUuid(raw.id)) return { ok: false, message: ADMIN_MISSING };
  try {
    return fromWrite(
      await store.setCategoryActive({
        actorId: admin.userId,
        id: raw.id,
        isActive: raw.isActive,
        now,
        ipAddress,
      }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function loadUsers(
  access: AdminAccess,
  query: string,
  requestedPage: unknown,
  store: AdminStore,
) {
  return guard(access, async () => {
    const page = pageNumber(requestedPage);
    const found = await store.searchUsers(normalizeSearch(query), page, ADMIN_PAGE_SIZE);
    return { ok: true as const, page, pageSize: ADMIN_PAGE_SIZE, ...found };
  });
}

export async function loadUser(access: AdminAccess, id: string, store: AdminStore) {
  return guard(access, async (actorId) => {
    if (!isUuid(id)) return { ok: false as const, reason: "missing" as const };
    const user = await store.getUser(id);
    if (!user) return { ok: false as const, reason: "missing" as const };
    return { ok: true as const, user, viewerId: actorId };
  });
}

export async function setAdminAccountStatus(
  access: AdminAccess,
  raw: { userId: string; status: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  if (!isUuid(raw.userId) || !isAccountStatus(raw.status)) return { ok: false, message: ADMIN_INVALID };
  try {
    return fromWrite(
      await store.setAccountStatus({
        actorId: admin.userId,
        userId: raw.userId,
        status: raw.status,
        now,
        ipAddress,
      }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function grantAdminRole(
  access: AdminAccess,
  raw: { userId: string; role: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  const role = roleFromForm(raw.role);
  if (!isUuid(raw.userId) || !role) return { ok: false, message: ADMIN_ROLE };
  try {
    return fromWrite(
      await store.grantRole({ actorId: admin.userId, userId: raw.userId, role, now, ipAddress }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

export async function revokeAdminRole(
  access: AdminAccess,
  raw: { userId: string; role: string },
  store: AdminStore,
  now: Date,
  ipAddress: string | null,
): Promise<AdminResult> {
  const admin = requireAdmin(access);
  if (!admin.ok) return denied(admin.reason);
  const role = roleFromForm(raw.role);
  if (!isUuid(raw.userId) || !role) return { ok: false, message: ADMIN_ROLE };
  try {
    return fromWrite(
      await store.revokeRole({ actorId: admin.userId, userId: raw.userId, role, now, ipAddress }),
    );
  } catch {
    return { ok: false, message: ADMIN_SAVE_FAILED };
  }
}

function isAccountStatus(value: string): value is AccountStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "DISABLED";
}
