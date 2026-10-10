"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  assignIssueAction,
  changeStatusAction,
  commentAction,
  type DepartmentFormState,
} from "@/lib/issues/staff-actions";
import { statusLabel } from "@/lib/issues/labels";
import type { IssueStatusValue } from "@/lib/issues/types";

const initial: DepartmentFormState = { message: "" };

const controlClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

function FormAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive">
      {message}
    </p>
  );
}

export function AssignmentForm({
  issueId,
  members,
  assigneeId,
}: {
  issueId: string;
  members: { id: string; name: string }[];
  assigneeId: string | null;
}) {
  const [state, action, pending] = useActionState(assignIssueAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="issueId" value={issueId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assigneeId">Assignee</Label>
        <select
          id="assigneeId"
          name="assigneeId"
          defaultValue={assigneeId ?? ""}
          className={controlClass}
        >
          <option value="">Department queue</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assignment-note">Note</Label>
        <Input id="assignment-note" name="note" maxLength={500} autoComplete="off" />
        <p className="text-small text-muted-foreground">Optional. Visible to your department.</p>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Save assignment"}
      </Button>
    </form>
  );
}

export function StatusForm({
  issueId,
  transitions,
}: {
  issueId: string;
  transitions: IssueStatusValue[];
}) {
  const [state, action, pending] = useActionState(changeStatusAction, initial);
  if (transitions.length === 0) {
    return <p>No further status changes are permitted from the current status.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="issueId" value={issueId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="toStatus">New status</Label>
        <select id="toStatus" name="toStatus" required defaultValue="" className={controlClass}>
          <option value="">Choose a status</option>
          {transitions.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status-reason">Reason</Label>
        <Input id="status-reason" name="reason" maxLength={1000} autoComplete="off" />
        <p className="text-small text-muted-foreground">
          Required when rejecting or reopening a report.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Update status"}
      </Button>
    </form>
  );
}

export function CommentForm({ issueId }: { issueId: string }) {
  const [state, action, pending] = useActionState(commentAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormAlert message={state.message} />
      <input type="hidden" name="issueId" value={issueId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comment-body">Comment</Label>
        <Textarea id="comment-body" name="body" required maxLength={2000} />
        <p className="text-small text-muted-foreground">
          The person who reported this issue can read the comment.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : "Add comment"}
      </Button>
    </form>
  );
}
