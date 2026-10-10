import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusMark } from "@/components/issue-mark";
import { formatWhen } from "@/lib/issues/labels";
import { EXPLORE_UNAVAILABLE } from "@/lib/issues/messages";
import { loadPublicIssue } from "@/lib/issues/queries";

export const dynamic = "force-dynamic";

export default async function PublicIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadPublicIssue(id);
  if (!result.ok && result.reason === "missing") notFound();
  if (!result.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Published report</h1>
        <p role="alert">{EXPLORE_UNAVAILABLE}</p>
        <p className="text-small">
          <Link href="/explore">Explore issues</Link>
        </p>
      </main>
    );
  }

  const issue = result.issue;
  const place = issue.locality ? `${issue.locality}, ${issue.city}` : issue.city;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <p className="text-small">
        <Link href="/explore">Explore issues</Link>
      </p>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{issue.title}</h1>
        <p className="mt-3">
          <StatusMark status={issue.status} />
        </p>
      </div>
      <dl className="overflow-hidden rounded-md border border-border bg-card text-small">
        <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:justify-between">
          <dt className="font-semibold">Category</dt>
          <dd>{issue.categoryName}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:justify-between">
          <dt className="font-semibold">Place</dt>
          <dd>{place}</dd>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
          <dt className="font-semibold">Reported</dt>
          <dd>
            <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
          </dd>
        </div>
      </dl>
    </main>
  );
}
