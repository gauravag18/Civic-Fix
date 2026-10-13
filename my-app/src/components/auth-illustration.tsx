export function AuthIllustration() {
  return (
    <figure className="overflow-hidden rounded-md border border-border bg-background p-6">
      <svg viewBox="0 0 420 320" className="h-auto w-full" aria-hidden="true">
        <rect width="420" height="320" fill="#F7F3EB" />
        <rect x="0" y="210" width="420" height="110" fill="#EFE6D8" />
        <path d="M0 248c70-28 120-8 190 6s110 18 230-16v82H0Z" fill="#E4D8C8" />
        <rect x="78" y="168" width="8" height="78" fill="#654737" />
        <circle cx="82" cy="132" r="28" fill="#145C36" />
        <circle cx="62" cy="150" r="18" fill="#145C36" />
        <circle cx="104" cy="148" r="16" fill="#1E6B42" />
        <rect x="248" y="118" width="6" height="128" fill="#34251D" />
        <path d="M251 118c28 8 46 28 46 28" fill="none" stroke="#34251D" strokeWidth="4" />
        <circle cx="300" cy="148" r="16" fill="#A65F43" />
        <rect x="292" y="148" width="16" height="22" fill="#F7C56A" opacity="0.85" />
        <rect x="150" y="196" width="72" height="8" rx="2" fill="#654737" />
        <rect x="158" y="204" width="6" height="22" fill="#34251D" />
        <rect x="208" y="204" width="6" height="22" fill="#34251D" />
        <rect x="36" y="236" width="348" height="6" fill="#C4B29E" />
        <rect x="168" y="258" width="28" height="8" rx="2" fill="#78695D" />
        <rect x="176" y="266" width="12" height="6" fill="#A65F43" />
      </svg>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Lighting, paths, and the small repairs a report can start.
      </figcaption>
    </figure>
  );
}
