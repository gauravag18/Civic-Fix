"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { StatusMark } from "@/components/issue-mark";
import { formatWhen } from "@/lib/issues/labels";
import type { PublicMapItem } from "@/lib/issues/discovery";

const PublicExploreMap = dynamic(
  () => import("@/components/maps/public-explore-map").then((module) => module.PublicExploreMap),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="flex h-80 items-center rounded-md border border-border bg-card px-4 text-sm text-muted-foreground">
        Loading map
      </p>
    ),
  },
);

const viewButton =
  "rounded-md border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PublicCards({ items }: { items: PublicMapItem[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {items.map((issue) => (
        <li key={issue.id} className="rounded-md border border-border bg-card px-4 py-4">
          <h2 className="text-subsection font-semibold">
            <Link href={`/explore/${issue.id}`}>{issue.title}</Link>
          </h2>
          <p className="mt-2">
            <StatusMark status={issue.status} />
          </p>
          <p className="mt-2 text-small text-muted-foreground">
            {issue.categoryName}
            {" · "}
            {issue.locality ? `${issue.locality}, ${issue.city}` : issue.city}
            {" · "}
            <time dateTime={issue.createdAt}>{formatWhen(new Date(issue.createdAt))} UTC</time>
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ExploreBrowser({
  tiles,
  items,
  emptyMessage,
}: {
  tiles: { url: string; attribution: string };
  items: PublicMapItem[];
  emptyMessage: string;
}) {
  const [view, setView] = useState<"list" | "map">("list");

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Explore view" className="flex flex-wrap gap-2">
        <button
          type="button"
          className={view === "list" ? `${viewButton} bg-primary text-primary-foreground` : `${viewButton} bg-card`}
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          List
        </button>
        <button
          type="button"
          className={view === "map" ? `${viewButton} bg-primary text-primary-foreground` : `${viewButton} bg-card`}
          aria-pressed={view === "map"}
          onClick={() => setView("map")}
        >
          Map
        </button>
      </div>
      {view === "map" ? (
        <div className="flex flex-col gap-4">
          <p className="max-w-3xl text-sm text-muted-foreground">
            These published reports are not placed on the map. CivicFix stores an exact point on the private report, and the public record has only a locality and city. Those names are not turned into map positions, so the exact coordinates stay off this page. The list below is the same filtered page.
          </p>
          <PublicExploreMap tiles={tiles} />
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-card px-4 py-6">{emptyMessage}</p>
      ) : (
        <PublicCards items={items} />
      )}
    </div>
  );
}
