import { randomUUID } from "node:crypto";
import type { NotificationType } from "@/generated/prisma/enums";
import type { AppNotification, NotificationStore } from "@/lib/notifications/service";

type StoredNotification = AppNotification & { recipientId: string };

export class MemoryNotificationStore implements NotificationStore {
  readonly rows: StoredNotification[] = [];

  add(input: {
    recipientId: string;
    type: NotificationType;
    title: string;
    body: string;
    issueId: string | null;
    commentId: string | null;
    createdAt: Date;
  }): void {
    this.rows.push({ ...input, id: randomUUID(), readAt: null });
  }

  async list(userId: string, page: number, pageSize: number) {
    const mine = this.rows
      .filter((row) => row.recipientId === userId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
      );
    const start = (page - 1) * pageSize;
    return {
      total: mine.length,
      unread: mine.filter((row) => row.readAt === null).length,
      items: mine.slice(start, start + pageSize).map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        issueId: row.issueId,
        commentId: row.commentId,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
    };
  }

  async markRead(userId: string, id: string, now: Date) {
    const row = this.rows.find((item) => item.id === id && item.recipientId === userId);
    if (!row) return "missing" as const;
    if (!row.readAt) row.readAt = now;
    return "updated" as const;
  }

  async markAllRead(userId: string, now: Date) {
    for (const row of this.rows) {
      if (row.recipientId === userId && row.readAt === null) row.readAt = now;
    }
  }

  async unreadCount(userId: string) {
    return this.rows.filter((row) => row.recipientId === userId && row.readAt === null).length;
  }
}
