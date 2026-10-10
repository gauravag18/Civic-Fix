import Link from "next/link";
import { StatusMark } from "@/components/issue-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicExploreHref } from "@/lib/issues/discovery";
import { formatWhen, statusLabel } from "@/lib/issues/labels";
import { EXPLORE_INVALID, EXPLORE_UNAVAILABLE } from "@/lib/issues/messages";
import { loadExplore } from "@/lib/issues/queries";
import type { IssueStatusValue, PublicListFilters } from "@/lib/issues/types";
import { IssueStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const controlClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const loaded = await loadExplore(params);
  const result = loaded.result;
  const filters: PublicListFilters = result.ok
    ? result.filters
    : { q: "", categoryId: null, status: null, sort: "newest" };
  const lastPage = result.ok ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const filtered = Boolean(filters.q || filters.categoryId || filters.status || filters.sort !== "newest");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Explore issues</h1>
        <p className="mt-2 text-muted-foreground">
          Published reports list a title, category, locality, city, status, and date. A report appears here only after its reporter publishes it.
        </p>
      </div>

      <form method="get" action="/explore" className="grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label htmlFor="explore-q" className="text-sm font-semibold">
            Title
          </label>
          <Input id="explore-q" name="q" defaultValue={typeof params.q === "string" ? params.q : ""} maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="explore-category" className="text-sm font-semibold">
            Category
          </label>
          <select id="explore-category" name="category" defaultValue={filters.categoryId ?? ""} className={controlClass}>
            <option value="">Any category</option>
            {loaded.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="explore-status" className="text-sm font-semibold">
            Status
          </label>
          <select id="explore-status" name="status" defaultValue={filters.status ?? ""} className={controlClass}>
            <option value="">Any status</option>
            {Object.values(IssueStatus).map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="explore-sort" className="text-sm font-semibold">
            Sort
          </label>
          <select id="explore-sort" name="sort" defaultValue={filters.sort} className={controlClass}>
            <option value="newest">Newest</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2 lg:col-span-5">
          <Button type="submit">Search</Button>
          {filtered ? (
            <Link href="/explore" className="text-sm font-semibold">
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      {!result.ok && result.reason === "invalid" ? <p role="alert">{EXPLORE_INVALID}</p> : null}
      {!result.ok && result.reason === "unavailable" ? <p role="alert">{EXPLORE_UNAVAILABLE}</p> : null}
      {result.ok && result.total === 0 ? (
        <p className="rounded-md border border-border bg-card px-4 py-6">
          {filtered ? "No published reports match this search." : "No reports have been published."}
        </p>
      ) : null}
      {result.ok && result.total > 0 ? (
        <>
          <ol className="grid gap-4 sm:grid-cols-2">
            {result.items.map((issue) => (
              <li key={issue.id} className="rounded-md border border-border bg-card px-4 py-4">
                <h2 className="text-subsection font-semibold">
                  <Link href={`/explore/${issue.id}`}>{issue.title}</Link>
                </h2>
                <p className="mt-2">
                  <StatusMark status={issue.status as IssueStatusValue} />
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  {issue.categoryName}
                  {" · "}
                  {issue.locality ? `${issue.locality}, ${issue.city}` : issue.city}
                  {" · "}
                  <time dateTime={issue.createdAt.toISOString()}>{formatWhen(issue.createdAt)} UTC</time>
                </p>
              </li>
            ))}
          </ol>
          <nav aria-label="Pages" className="flex flex-wrap items-center gap-4 text-small">
            <p>
              Page {result.page} of {lastPage}
            </p>
            {result.page > 1 ? <Link href={publicExploreHref(filters, result.page - 1)}>Previous</Link> : null}
            {result.page < lastPage ? <Link href={publicExploreHref(filters, result.page + 1)}>Next</Link> : null}
          </nav>
        </>
      ) : null}
    </main>
  );
}
