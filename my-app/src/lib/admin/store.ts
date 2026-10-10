import type { AccountStatus, IssueStatus } from "@/generated/prisma/enums";
import type { RoleCode } from "@/lib/auth/roles";
import type {
  CategorySummary,
  DashboardCounts,
  DepartmentDetail,
  DepartmentSummary,
  EligibleStaff,
  UserDetail,
  UserSummary,
} from "@/lib/admin/types";

export type AdminWriteResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      reason:
        | "duplicate"
        | "invalid"
        | "missing"
        | "blocked"
        | "self"
        | "last_admin"
        | "membership"
        | "role"
        | "unavailable";
    };

export type AdminStore = {
  counts(): Promise<DashboardCounts>;
  searchDepartments(
    query: string,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: DepartmentSummary[] }>;
  getDepartment(id: string): Promise<DepartmentDetail | null>;
  eligibleStaff(departmentId: string): Promise<EligibleStaff[]>;
  createDepartment(input: {
    actorId: string;
    code: string;
    name: string;
    description: string | null;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  updateDepartment(input: {
    actorId: string;
    id: string;
    name: string;
    description: string | null;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  setDepartmentActive(input: {
    actorId: string;
    id: string;
    isActive: boolean;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  addMembership(input: {
    actorId: string;
    departmentId: string;
    userId: string;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  endMembership(input: {
    actorId: string;
    membershipId: string;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  searchCategories(
    query: string,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: CategorySummary[] }>;
  getCategory(id: string): Promise<CategorySummary | null>;
  createCategory(input: {
    actorId: string;
    code: string;
    name: string;
    sortOrder: number;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  updateCategory(input: {
    actorId: string;
    id: string;
    name: string;
    sortOrder: number;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  setCategoryActive(input: {
    actorId: string;
    id: string;
    isActive: boolean;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  searchUsers(
    query: string,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: UserSummary[] }>;
  getUser(id: string): Promise<UserDetail | null>;
  setAccountStatus(input: {
    actorId: string;
    userId: string;
    status: AccountStatus;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  grantRole(input: {
    actorId: string;
    userId: string;
    role: RoleCode;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
  revokeRole(input: {
    actorId: string;
    userId: string;
    role: RoleCode;
    now: Date;
    ipAddress: string | null;
  }): Promise<AdminWriteResult>;
};

export type MemoryAudit = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, string | null>;
};

export type MemoryAdminUser = {
  id: string;
  email: string;
  name: string;
  accountStatus: AccountStatus;
  disabledAt: Date | null;
  emailVerifiedAt: Date | null;
  roles: RoleCode[];
};

export type MemoryDepartment = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type MemoryMembership = {
  id: string;
  userId: string;
  departmentId: string;
  startedAt: Date;
  endedAt: Date | null;
};

export type MemoryAssignment = {
  id: string;
  issueId: string;
  departmentId: string;
  assigneeId: string | null;
  endedAt: Date | null;
};

export type MemoryCategory = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  issueCount: number;
};

export type MemoryIssue = {
  id: string;
  status: IssueStatus;
};
