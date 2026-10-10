import "server-only";

import {
  loadActiveDepartments,
  loadCategories,
  loadCategory,
  loadDashboard,
  loadDepartment,
  loadDepartments,
  loadUser,
  loadUsers,
} from "@/lib/admin/service";
import { createPrismaAdminStore } from "@/lib/admin/prisma-store";
import type { AdminAccess } from "@/lib/admin/types";
import { getAuthorization } from "@/lib/auth/authorization";

async function access(): Promise<AdminAccess> {
  const authorization = await getAuthorization();
  if (!authorization) return null;
  return { userId: authorization.userId, capabilities: authorization.capabilities };
}

export async function loadAdminDashboard() {
  return loadDashboard(await access(), createPrismaAdminStore());
}

export async function loadAdminDepartments(query: string, requestedPage: unknown) {
  return loadDepartments(await access(), query, requestedPage, createPrismaAdminStore());
}

export async function loadAdminDepartment(id: string) {
  return loadDepartment(await access(), id, createPrismaAdminStore());
}

export async function loadAdminCategories(query: string, requestedPage: unknown) {
  return loadCategories(await access(), query, requestedPage, createPrismaAdminStore());
}

export async function loadAdminCategory(id: string) {
  return loadCategory(await access(), id, createPrismaAdminStore());
}

export async function loadAdminUsers(query: string, requestedPage: unknown) {
  return loadUsers(await access(), query, requestedPage, createPrismaAdminStore());
}

export async function loadAdminUser(id: string) {
  return loadUser(await access(), id, createPrismaAdminStore());
}

export async function loadStaffProvision() {
  return loadActiveDepartments(await access(), createPrismaAdminStore());
}
