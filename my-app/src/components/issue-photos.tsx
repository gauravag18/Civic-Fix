"use client";

import { useState } from "react";

export function IssuePhotos({ images }: { images: { id: string }[] }) {
  if (images.length === 0) return null;
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

function IssuePhoto({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p className="text-small">This photograph is unavailable.</p>;
  }
  return (
    <img
      src={`/api/issue-images/${id}`}
      alt="Photograph attached to this report"
      className="h-36 w-full border border-border object-cover"
      onError={() => setFailed(true)}
    />
  );
}
