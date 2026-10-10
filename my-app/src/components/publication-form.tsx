"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setIssuePublication, type PublicationFormState } from "@/lib/issues/publication-actions";

const initial: PublicationFormState = { message: "" };

const publicFields =
  "Publishing shows this report’s title, category, locality, city, status, and report date on Explore. The description, street address, postal code, coordinates, photographs, comments, assignment, and your name stay off the public page.";

export function PublicationForm({
  issueId,
  published,
}: {
  issueId: string;
  published: boolean;
}) {
  const [state, action, pending] = useActionState(setIssuePublication, initial);

  return (
    <section aria-labelledby="publication" className="rounded-md border border-border bg-card px-4 py-4">
      <h2 id="publication" className="text-section font-semibold">
        {published ? "This report is on Explore" : "Explore"}
      </h2>
      <p className="mt-2 max-w-prose text-small text-muted-foreground">{publicFields}</p>
      {state.message ? (
        <p role="alert" className="mt-3 text-destructive">
          {state.message}
        </p>
      ) : null}
      <form action={action} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="issueId" value={issueId} />
        <input type="hidden" name="intent" value={published ? "unpublish" : "publish"} />
        <label className="flex items-start gap-2 text-small">
          <input type="checkbox" name="confirm" value="yes" required className="mt-1" />
          <span>
            {published
              ? "Remove this report from Explore."
              : "I understand these fields will be public."}
          </span>
        </label>
        <div>
          <Button type="submit" variant={published ? "secondary" : "default"} disabled={pending}>
            {pending ? "Saving" : published ? "Remove from Explore" : "Publish on Explore"}
          </Button>
        </div>
      </form>
    </section>
  );
}
