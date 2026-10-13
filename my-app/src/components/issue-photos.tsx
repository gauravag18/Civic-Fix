"use client";

import { useState } from "react";

export function IssuePhotos({
  images,
  layout = "grid",
}: {
  images: { id: string }[];
  layout?: "grid" | "stack";
}) {
  if (images.length === 0) return null;
  if (layout === "stack") {
    const [first, ...rest] = images;
    return (
      <div className="flex flex-col gap-3">
        {first ? <IssuePhoto id={first.id} cover /> : null}
        {rest.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {rest.map((image) => (
              <li key={image.id}>
                <IssuePhoto id={image.id} tall />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <section aria-labelledby="photographs" className="flex flex-col gap-3">
      <h2 id="photographs" className="text-section font-semibold">
        Photographs
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image) => (
          <li key={image.id}>
            <IssuePhoto id={image.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssuePhoto({ id, tall = false, cover = false }: { id: string; tall?: boolean; cover?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p className="text-small">This photograph is unavailable.</p>;
  }
  return (
    <img
      src={`/api/issue-images/${id}`}
      alt="Photograph attached to this report"
      className={
        cover
          ? "aspect-[4/3] w-full rounded-md bg-muted object-cover lg:aspect-[3/4]"
          : tall
            ? "aspect-[4/3] w-full rounded-md bg-muted object-cover"
            : "h-40 w-full rounded-md border border-border bg-muted object-cover"
      }
      onError={() => setFailed(true)}
    />
  );
}
