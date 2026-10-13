export function StreetSketch({ caption = true }: { caption?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-md border border-border bg-card p-6 shadow-[var(--elevation-raised)]">
      <svg viewBox="0 0 420 320" className="h-auto w-full" aria-hidden="true">
        <rect width="420" height="320" fill="#FFFCF6" />
        <rect x="0" y="230" width="420" height="90" fill="#EFE6D8" />
        <rect x="36" y="86" width="78" height="144" fill="#34251D" />
        <rect x="126" y="54" width="96" height="176" fill="#654737" />
        <rect x="236" y="108" width="70" height="122" fill="#A65F43" />
        <rect x="48" y="108" width="18" height="22" fill="#F7F3EB" />
        <rect x="78" y="108" width="18" height="22" fill="#F7F3EB" />
        <rect x="48" y="146" width="18" height="22" fill="#F7F3EB" />
        <rect x="78" y="146" width="18" height="22" fill="#F7F3EB" />
        <rect x="146" y="78" width="20" height="24" fill="#FFFCF6" />
        <rect x="178" y="78" width="20" height="24" fill="#FFFCF6" />
        <rect x="146" y="116" width="20" height="24" fill="#FFFCF6" />
        <rect x="178" y="116" width="20" height="24" fill="#FFFCF6" />
        <rect x="252" y="128" width="18" height="20" fill="#FFFCF6" />
        <rect x="278" y="128" width="18" height="20" fill="#FFFCF6" />
        <rect x="330" y="150" width="8" height="80" fill="#654737" />
        <circle cx="334" cy="142" r="22" fill="#A65F43" />
        <path d="M40 250h340" stroke="#34251D" strokeWidth="4" />
        <path d="M70 268h80M190 268h70M300 268h50" stroke="#C4B29E" strokeWidth="4" />
      </svg>
      {caption ? (
        <figcaption className="mt-3 text-sm text-muted-foreground">
          Streets, lighting, drainage, and sanitation.
        </figcaption>
      ) : null}
    </figure>
  );
}
