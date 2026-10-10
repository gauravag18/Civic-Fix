import { randomUUID } from "node:crypto";
import { deactivationBlock, removesLastAdmin } from "@/lib/admin/rules";
import type { AdminStore, MemoryAdminUser, MemoryAssignment, MemoryAudit, MemoryCategory, MemoryDepartment, MemoryIssue, MemoryMembership } from "@/lib/admin/store";
import { ISSUE_STATUSES } from "@/lib/admin/types";

function includes(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function page<T>(rows: T[], pageNumber: number, pageSize: number) {
  const start = (pageNumber - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export class MemoryAdminStore implements AdminStore {
  readonly users: MemoryAdminUser[] = [];
  readonly departments: MemoryDepartment[] = [];
  readonly memberships: MemoryMembership[] = [];
  readonly assignments: MemoryAssignment[] = [];
  readonly categories: MemoryCategory[] = [];
  readonly issues: MemoryIssue[] = [];
  readonly audits: MemoryAudit[] = [];
  readonly revokedUsers: string[] = [];

  async counts() {
    const issuesByStatus = ISSUE_STATUSES.map((status) => ({
      status,
      count: this.issues.filter((issue) => issue.status === status).length,
    }));
    return {
      issues: this.issues.length,
      issuesByStatus,
      activeDepartments: this.departments.filter((department) => department.isActive).length,
      departments: this.departments.length,
      activeMemberships: this.memberships.filter((membership) => membership.endedAt === null).length,
      users: this.users.length,
      categories: this.categories.length,
      activeCategories: this.categories.filter((category) => category.isActive).length,
    };
  }

  async searchDepartments(query: string, pageNumber: number, pageSize: number) {
    const rows = this.departments
      .filter((department) => !query || includes(department.name, query) || includes(department.code, query))
      .sort((left, right) => left.name.localeCompare(right.name));
    return {
      total: rows.length,
      items: page(rows, pageNumber, pageSize).map((department) => ({
        id: department.id,
        code: department.code,
        name: department.name,
        isActive: department.isActive,
        activeMemberships: this.activeMemberships(department.id).length,
        activeAssignments: this.activeAssignments(department.id).length,
      })),
    };
  }

  async getDepartment(id: string) {
    const department = this.departments.find((row) => row.id === id);
    if (!department) return null;
    return {
      ...department,
      activeAssignments: this.activeAssignments(id).length,
      memberships: this.activeMemberships(id).map((membership) => {
        const user = this.users.find((row) => row.id === membership.userId);
        return {
          id: membership.id,
          userId: membership.userId,
          name: user?.name ?? "Staff",
          email: user?.email ?? "",
          startedAt: membership.startedAt,
        };
      }),
    };
  }

  async eligibleStaff(departmentId: string) {
    return this.users
      .filter((user) => this.canJoinDepartment(user, departmentId))
      .map((user) => ({ id: user.id, name: user.name, email: user.email }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async createDepartment(input: Parameters<AdminStore["createDepartment"]>[0]) {
    if (this.departments.some((row) => row.code === input.code || row.name === input.name)) {
      return { ok: false as const, reason: "duplicate" as const };
    }
    const id = randomUUID();
    this.departments.push({
      id,
      code: input.code,
      name: input.name,
      description: input.description,
      isActive: true,
      createdAt: input.now,
    });
    this.audit(input, "department.create", "Department", id, { code: input.code });
    return { ok: true as const, id };
  }

  async updateDepartment(input: Parameters<AdminStore["updateDepartment"]>[0]) {
    const department = this.departments.find((row) => row.id === input.id);
    if (!department) return { ok: false as const, reason: "missing" as const };
    if (this.departments.some((row) => row.id !== input.id && row.name === input.name)) {
      return { ok: false as const, reason: "duplicate" as const };
    }
    department.name = input.name;
    department.description = input.description;
    this.audit(input, "department.update", "Department", department.id, { code: department.code });
    return { ok: true as const, id: department.id };
  }

  async setDepartmentActive(input: Parameters<AdminStore["setDepartmentActive"]>[0]) {
    const department = this.departments.find((row) => row.id === input.id);
    if (!department) return { ok: false as const, reason: "missing" as const };
    if (!input.isActive) {
      const block = deactivationBlock(
        this.activeAssignments(department.id).length,
        this.activeMemberships(department.id).length,
      );
      if (block) return { ok: false as const, reason: "blocked" as const };
    }
    department.isActive = input.isActive;
    this.audit(input, input.isActive ? "department.activate" : "department.deactivate", "Department", department.id, {
      code: department.code,
    });
    return { ok: true as const, id: department.id };
  }

  async addMembership(input: Parameters<AdminStore["addMembership"]>[0]) {
    const department = this.departments.find((row) => row.id === input.departmentId && row.isActive);
    const user = this.users.find((row) => row.id === input.userId);
    if (!department || !user || !this.canJoinDepartment(user, department.id)) {
      return { ok: false as const, reason: "membership" as const };
    }
    const id = randomUUID();
    this.memberships.push({
      id,
      userId: user.id,
      departmentId: department.id,
      startedAt: input.now,
      endedAt: null,
    });
    this.audit(input, "membership.start", "DepartmentMembership", id, {
      departmentId: department.id,
      userId: user.id,
    });
    return { ok: true as const, id };
  }

  async endMembership(input: Parameters<AdminStore["endMembership"]>[0]) {
    const membership = this.memberships.find((row) => row.id === input.membershipId && row.endedAt === null);
    if (!membership) return { ok: false as const, reason: "missing" as const };
    membership.endedAt = input.now;
    let cleared = 0;
    for (const assignment of this.assignments) {
      if (
        assignment.endedAt === null &&
        assignment.departmentId === membership.departmentId &&
        assignment.assigneeId === membership.userId
      ) {
        assignment.assigneeId = null;
        cleared += 1;
      }
    }
    this.audit(input, "membership.end", "DepartmentMembership", membership.id, {
      departmentId: membership.departmentId,
      userId: membership.userId,
      clearedAssignees: String(cleared),
    });
    return { ok: true as const, id: membership.id };
  }

  async searchCategories(query: string, pageNumber: number, pageSize: number) {
    const rows = this.categories
      .filter((category) => !query || includes(category.name, query) || includes(category.code, query))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    return { total: rows.length, items: page(rows, pageNumber, pageSize) };
  }

  async getCategory(id: string) {
    return this.categories.find((row) => row.id === id) ?? null;
  }

  async createCategory(input: Parameters<AdminStore["createCategory"]>[0]) {
    if (this.categories.some((row) => row.code === input.code || row.name === input.name)) {
      return { ok: false as const, reason: "duplicate" as const };
    }
    const id = randomUUID();
    this.categories.push({
      id,
      code: input.code,
      name: input.name,
      isActive: true,
      sortOrder: input.sortOrder,
      issueCount: 0,
    });
    this.audit(input, "category.create", "IssueCategory", id, { code: input.code });
    return { ok: true as const, id };
  }

  async updateCategory(input: Parameters<AdminStore["updateCategory"]>[0]) {
    const category = this.categories.find((row) => row.id === input.id);
    if (!category) return { ok: false as const, reason: "missing" as const };
    if (this.categories.some((row) => row.id !== input.id && row.name === input.name)) {
      return { ok: false as const, reason: "duplicate" as const };
    }
    category.name = input.name;
    category.sortOrder = input.sortOrder;
    this.audit(input, "category.update", "IssueCategory", category.id, { code: category.code });
    return { ok: true as const, id: category.id };
  }

  async setCategoryActive(input: Parameters<AdminStore["setCategoryActive"]>[0]) {
    const category = this.categories.find((row) => row.id === input.id);
    if (!category) return { ok: false as const, reason: "missing" as const };
    category.isActive = input.isActive;
    this.audit(input, input.isActive ? "category.activate" : "category.deactivate", "IssueCategory", category.id, {
      code: category.code,
    });
    return { ok: true as const, id: category.id };
  }

  async searchUsers(query: string, pageNumber: number, pageSize: number) {
    const rows = this.users
      .filter((user) => !query || includes(user.name, query) || includes(user.email, query))
      .sort((left, right) => left.name.localeCompare(right.name));
    return { total: rows.length, items: page(rows, pageNumber, pageSize).map((user) => this.summary(user)) };
  }

  async getUser(id: string) {
    const user = this.users.find((row) => row.id === id);
    if (!user) return null;
    const membership = this.memberships.find((row) => row.userId === id && row.endedAt === null);
    const department = membership
      ? this.departments.find((row) => row.id === membership.departmentId)
      : undefined;
    return {
      ...this.summary(user),
      emailVerifiedAt: user.emailVerifiedAt,
      disabledAt: user.disabledAt,
      departmentId: department?.id ?? null,
    };
  }

  async setAccountStatus(input: Parameters<AdminStore["setAccountStatus"]>[0]) {
    if (input.actorId === input.userId) return { ok: false as const, reason: "self" as const };
    const user = this.users.find((row) => row.id === input.userId);
    if (!user) return { ok: false as const, reason: "missing" as const };
    if (input.status !== "ACTIVE" && this.isCountedAdmin(user) && removesLastAdmin(this.countedAdmins())) {
      return { ok: false as const, reason: "last_admin" as const };
    }
    user.accountStatus = input.status;
    user.disabledAt = input.status === "DISABLED" ? input.now : input.status === "ACTIVE" ? null : user.disabledAt;
    if (input.status !== "ACTIVE") this.revokedUsers.push(user.id);
    this.audit(input, "user.status", "User", user.id, { status: input.status });
    return { ok: true as const, id: user.id };
  }

  async grantRole(input: Parameters<AdminStore["grantRole"]>[0]) {
    if (input.actorId === input.userId) return { ok: false as const, reason: "self" as const };
    const user = this.users.find((row) => row.id === input.userId);
    if (!user) return { ok: false as const, reason: "missing" as const };
    if (!this.roleExists(input.role)) return { ok: false as const, reason: "role" as const };
    if (user.roles.includes(input.role)) return { ok: false as const, reason: "role" as const };
    user.roles.push(input.role);
    this.audit(input, "role.grant", "UserRole", user.id, { role: input.role });
    return { ok: true as const, id: user.id };
  }

  async revokeRole(input: Parameters<AdminStore["revokeRole"]>[0]) {
    if (input.actorId === input.userId) return { ok: false as const, reason: "self" as const };
    const user = this.users.find((row) => row.id === input.userId);
    if (!user || !user.roles.includes(input.role)) return { ok: false as const, reason: "missing" as const };
    if (input.role === "ADMINISTRATOR" && this.isCountedAdmin(user) && removesLastAdmin(this.countedAdmins())) {
      return { ok: false as const, reason: "last_admin" as const };
    }
    user.roles = user.roles.filter((role) => role !== input.role);
    this.audit(input, "role.revoke", "UserRole", user.id, { role: input.role });
    return { ok: true as const, id: user.id };
  }

  private summary(user: MemoryAdminUser) {
    const membership = this.memberships.find((row) => row.userId === user.id && row.endedAt === null);
    const department = membership
      ? this.departments.find((row) => row.id === membership.departmentId)
      : undefined;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      accountStatus: user.accountStatus,
      roles: [...user.roles],
      departmentName: department?.name ?? null,
    };
  }

  private canJoinDepartment(user: MemoryAdminUser, departmentId: string): boolean {
    if (!user.roles.includes("DEPARTMENT_STAFF")) return false;
    if (user.accountStatus !== "ACTIVE" || user.disabledAt || !user.emailVerifiedAt) return false;
    if (this.memberships.some((row) => row.userId === user.id && row.endedAt === null)) return false;
    return this.departments.some((row) => row.id === departmentId && row.isActive);
  }

  private activeMemberships(departmentId: string) {
    return this.memberships.filter((row) => row.departmentId === departmentId && row.endedAt === null);
  }

  private activeAssignments(departmentId: string) {
    return this.assignments.filter((row) => row.departmentId === departmentId && row.endedAt === null);
  }

  private isCountedAdmin(user: MemoryAdminUser): boolean {
    return user.roles.includes("ADMINISTRATOR") && user.accountStatus === "ACTIVE" && user.disabledAt === null;
  }

  private countedAdmins(): number {
    return this.users.filter((user) => this.isCountedAdmin(user)).length;
  }

  private roleExists(role: string): boolean {
    return role === "CITIZEN" || role === "DEPARTMENT_STAFF" || role === "MODERATOR" || role === "ADMINISTRATOR";
  }

  private audit(
    input: { actorId: string; ipAddress: string | null },
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, string | null>,
  ) {
    void input.ipAddress;
    this.audits.push({ actorId: input.actorId, action, entityType, entityId, metadata });
  }
}
