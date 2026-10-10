import type { NotificationType } from "@/generated/prisma/enums";
import { pageNumber } from "@/lib/issues/service";
import { isUuid } from "@/lib/issues/validate";

export const NOTIFICATION_PAGE_SIZE = 10;

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  issueId: string | null;
  commentId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationPage = {
  total: number;
  unread: number;
  items: AppNotification[];
};

export type NotificationStore = {
  list(userId: string, page: number, pageSize: number): Promise<NotificationPage>;
  markRead(userId: string, id: string, now: Date): Promise<"updated" | "missing">;
  markAllRead(userId: string, now: Date): Promise<void>;
  unreadCount(userId: string): Promise<number>;
};

export type NotificationListResult =
  | {
      ok: true;
      page: number;
      pageSize: number;
      total: number;
      unread: number;
      items: AppNotification[];
    }
  | { ok: false; reason: "signed-out" | "unavailable" };

export async function listUserNotifications(
  userId: string | null,
  requestedPage: unknown,
  store: NotificationStore,
): Promise<NotificationListResult> {
  if (!userId) return { ok: false, reason: "signed-out" };
  try {
    const pageSize = NOTIFICATION_PAGE_SIZE;
    const requested = pageNumber(requestedPage);
    const first = await store.list(userId, requested, pageSize);
    const lastPage = Math.max(1, Math.ceil(first.total / pageSize));
    if (requested > lastPage) {
      const last = await store.list(userId, lastPage, pageSize);
      return {
        ok: true,
        page: lastPage,
        pageSize,
        total: last.total,
        unread: last.unread,
        items: last.items,
      };
    }
    return {
      ok: true,
      page: requested,
      pageSize,
      total: first.total,
      unread: first.unread,
      items: first.items,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function markOwnedNotification(
  userId: string | null,
  id: string,
  store: NotificationStore,
  now: Date,
): Promise<"updated" | "missing" | "signed-out"> {
  if (!userId) return "signed-out";
  if (!isUuid(id)) return "missing";
  return store.markRead(userId, id, now);
}

export async function markAllOwnedNotifications(
  userId: string | null,
  store: NotificationStore,
  now: Date,
): Promise<"updated" | "signed-out"> {
  if (!userId) return "signed-out";
  await store.markAllRead(userId, now);
  return "updated";
}

export function notificationHref(item: AppNotification): string | null {
  if (!item.issueId) return null;
  if (item.type === "ISSUE_ASSIGNED") return `/department/issues/${item.issueId}`;
  return `/issues/${item.issueId}`;
}
