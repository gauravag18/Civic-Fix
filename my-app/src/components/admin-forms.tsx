"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addMembershipAction,
  createCategoryAction,
  createDepartmentAction,
  endMembershipAction,
  grantRoleAction,
  revokeRoleAction,
  setAccountStatusAction,
  setCategoryActiveAction,
  setDepartmentActiveAction,
  updateCategoryAction,
  updateDepartmentAction,
  type AdminFormState,
} from "@/lib/admin/actions";
import type { AccountStatus } from "@/generated/prisma/enums";
import type { RoleCode } from "@/lib/auth/roles";

const initial: AdminFormState = { message: "" };

const controlClass =
  "h-10 w-full rounded-none border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

function FormAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive">
      {message}
    </p>
  );
}

export function DepartmentCreateForm() {
  const [state, action, pending] = useActionState(createDepartmentAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="department-code">Code</Label>
        <Input id="department-code" name="code" required maxLength={64} autoComplete="off" />
        <p className="text-small text-muted-foreground">Letters, numbers, and underscores. This cannot be changed later.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="department-name">Name</Label>
        <Input id="department-name" name="name" required maxLength={160} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="department-description">Description</Label>
        <Textarea id="department-description" name="description" maxLength={500} rows={4} />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Create department"}
      </Button>
    </form>
  );
}

export function DepartmentEditForm({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description: string | null;
}) {
  const [state, action, pending] = useActionState(updateDepartmentAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-department-name">Name</Label>
        <Input id="edit-department-name" name="name" required maxLength={160} defaultValue={name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-department-description">Description</Label>
        <Textarea
          id="edit-department-description"
          name="description"
          maxLength={500}
          rows={4}
          defaultValue={description ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Save department"}
      </Button>
    </form>
  );
}

export function ActiveToggleForm({
  id,
  isActive,
  kind,
}: {
  id: string;
  isActive: boolean;
  kind: "department" | "category";
}) {
  const actionFn = kind === "department" ? setDepartmentActiveAction : setCategoryActiveAction;
  const [state, action, pending] = useActionState(actionFn, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <Button type="submit" variant="outline" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : isActive ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}

export function MembershipAddForm({
  departmentId,
  staff,
}: {
  departmentId: string;
  staff: { id: string; name: string; email: string }[];
}) {
  const [state, action, pending] = useActionState(addMembershipAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="departmentId" value={departmentId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-user">Staff member</Label>
        <select id="staff-user" name="userId" required defaultValue="" className={controlClass}>
          <option value="" disabled>
            Choose a person
          </option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} ({person.email})
            </option>
          ))}
        </select>
        <p className="text-small text-muted-foreground">
          Only verified, active department staff without a current membership are listed.
        </p>
      </div>
      <Button type="submit" disabled={pending || staff.length === 0} className="w-full sm:w-auto">
        {pending ? "Saving" : "Add to department"}
      </Button>
    </form>
  );
}

export function MembershipEndForm({
  departmentId,
  membershipId,
}: {
  departmentId: string;
  membershipId: string;
}) {
  const [state, action, pending] = useActionState(endMembershipAction, initial);
  return (
    <form action={action}>
      <FormAlert message={state.message} />
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving" : "End membership"}
      </Button>
    </form>
  );
}

export function CategoryCreateForm() {
  const [state, action, pending] = useActionState(createCategoryAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-code">Code</Label>
        <Input id="category-code" name="code" required maxLength={64} autoComplete="off" />
        <p className="text-small text-muted-foreground">This cannot be changed later.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" name="name" required maxLength={160} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-order">Sort order</Label>
        <Input id="category-order" name="sortOrder" required inputMode="numeric" defaultValue="100" maxLength={5} />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Create category"}
      </Button>
    </form>
  );
}

export function CategoryEditForm({
  id,
  name,
  sortOrder,
}: {
  id: string;
  name: string;
  sortOrder: number;
}) {
  const [state, action, pending] = useActionState(updateCategoryAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-category-name">Name</Label>
        <Input id="edit-category-name" name="name" required maxLength={160} defaultValue={name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-category-order">Sort order</Label>
        <Input
          id="edit-category-order"
          name="sortOrder"
          required
          inputMode="numeric"
          maxLength={5}
          defaultValue={String(sortOrder)}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Save category"}
      </Button>
    </form>
  );
}

export function AccountStatusForm({
  userId,
  status,
}: {
  userId: string;
  status: AccountStatus;
}) {
  const [state, action, pending] = useActionState(setAccountStatusAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-status">Account status</Label>
        <select id="account-status" name="status" defaultValue={status} className={controlClass}>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Save status"}
      </Button>
    </form>
  );
}

export function GrantRoleForm({ userId, roles }: { userId: string; roles: RoleCode[] }) {
  const [state, action, pending] = useActionState(grantRoleAction, initial);
  const available = roles.filter((role) => role.length > 0);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="grant-role">Grant role</Label>
        <select id="grant-role" name="role" required defaultValue="" className={controlClass}>
          <option value="" disabled>
            Choose a role
          </option>
          {available.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending || available.length === 0} className="w-full sm:w-auto">
        {pending ? "Saving" : "Grant role"}
      </Button>
    </form>
  );
}

export function RevokeRoleForm({ userId, role }: { userId: string; role: RoleCode }) {
  const [state, action, pending] = useActionState(revokeRoleAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormAlert message={state.message} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving" : "Revoke"}
      </Button>
    </form>
  );
}
