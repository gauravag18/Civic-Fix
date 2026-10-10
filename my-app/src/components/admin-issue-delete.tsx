"use client";

import { useActionState } from "react";
import { deleteIssueAction } from "@/lib/issues/delete-actions";
import type { AdminFormState } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: AdminFormState = { message: "" };

export function IssueDeleteForm({ issueId, retry }: { issueId: string; retry: boolean }) {
  const [state, action, pending] = useActionState(deleteIssueAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.message ? (
        <p role="alert" className="text-destructive">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="issueId" value={issueId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmation">Report title</Label>
        <Input id="confirmation" name="confirmation" required maxLength={160} autoComplete="off" />
        <p className="text-small text-muted-foreground">Type the title exactly. This submits a deletion.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" name="reason" required maxLength={500} />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving" : retry ? "Retry photograph removal" : "Delete report"}
      </Button>
    </form>
  );
}
