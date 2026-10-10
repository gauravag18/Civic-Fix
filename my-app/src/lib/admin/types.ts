import { IssueStatus } from "@/generated/prisma/enums";
import type { AccountStatus } from "@/generated/prisma/enums";
import type { RoleCode } from "@/lib/auth/roles";

export const ADMIN_PAGE_SIZE = 10;

export const ISSUE_STATUSES = Object.values(IssueStatus);

export type AdminAccess = {
  userId: string;
  capabilities: ReadonlySet<string>;
} | null;

export type DashboardCounts = {
  issues: number;
  issuesByStatus: { status: IssueStatus; count: number }[];
  activeDepartments: number;
  departments: number;
  activeMemberships: number;
  users: number;
  categories: number;
  activeCategories: number;
};

export type DepartmentSummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  activeMemberships: number;
  activeAssignments: number;
};

export type MembershipSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  startedAt: Date;
};

export type DepartmentDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  activeAssignments: number;
  memberships: MembershipSummary[];
};

export type EligibleStaff = {
  id: string;
  name: string;
  email: string;
};

export type CategorySummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  issueCount: number;
};

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  accountStatus: AccountStatus;
  roles: RoleCode[];
  departmentName: string | null;
};

export type UserDetail = UserSummary & {
  emailVerifiedAt: Date | null;
  disabledAt: Date | null;
  departmentId: string | null;
};

export type AdminResult =
  | { ok: true }
  | { ok: false; message: string };
