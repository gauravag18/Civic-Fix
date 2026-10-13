import Link from "next/link";

export function Wordmark({ href = "/", icon = true }: { href?: string; icon?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-foreground">
      {icon ? (
        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8">
          <rect width="32" height="32" rx="6" fill="#34251D" />
          <path d="M8 22V12.5L16 8l8 4.5V22" fill="none" stroke="#F7F3EB" strokeWidth="1.6" />
          <path d="M13 22v-5h6v5" fill="none" stroke="#A65F43" strokeWidth="1.6" />
        </svg>
      ) : null}
      <span>CivicFix</span>
    </Link>
  );
}
