"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { markNotificationRead } from "@/lib/notifications/actions";

export type PanelNotice = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  when: string;
  iso: string;
  unread: boolean;
};

export function NotificationPanel({ unread, items }: { unread: number; items: PanelNotice[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        <span className="hidden sm:inline">Notifications</span>
        {unread > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Recent notifications"
          className="absolute right-0 z-30 mt-2 flex max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),22rem)] flex-col overflow-hidden rounded-md border border-border bg-card shadow-raised"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <Link href="/notifications" className="text-sm text-link no-underline hover:underline">
              View all
            </Link>
          </div>
          {items.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No notifications yet.</p> : null}
          <ul className="overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className={item.unread ? "border-b border-border bg-muted/60 px-3 py-3" : "border-b border-border px-3 py-3"}>
                <div className="flex gap-2">
                  <NoticeIcon type={item.type} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <time dateTime={item.iso}>{item.when}</time>
                      {item.unread ? " · Unread" : " · Read"}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-3 text-sm">
                      {item.href ? (
                        <Link href={item.href} className="text-link no-underline hover:underline">
                          Open report
                        </Link>
                      ) : null}
                      {item.unread ? (
                        <form action={markNotificationRead}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="font-semibold text-link">
                            Mark as read
                          </button>
                        </form>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current">
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeWidth="1.6" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeWidth="1.6" />
    </svg>
  );
}

function NoticeIcon({ type }: { type: string }) {
  const label =
    type === "COMMENT_ADDED" ? "Comment" : type === "ISSUE_ASSIGNED" ? "Assignment" : "Status";
  return (
    <span aria-label={label} className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
      {label.slice(0, 1)}
    </span>
  );
}
