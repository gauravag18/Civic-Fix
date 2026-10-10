import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import type { NotificationStore } from "@/lib/notifications/service";

export function createPrismaNotificationStore(): NotificationStore {
  const prisma = getPrismaClient();

  return {
    async list(userId, page, pageSize) {
      const where = { recipientId: userId };
      const [total, unread, rows] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
        prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            issueId: true,
            commentId: true,
            readAt: true,
            createdAt: true,
          },
        }),
      ]);
      return { total, unread, items: rows };
    },

    async markRead(userId, id, now) {
      const row = await prisma.notification.findFirst({
        where: { id, recipientId: userId },
        select: { id: true, readAt: true },
      });
      if (!row) return "missing";
      if (!row.readAt) {
        await prisma.notification.update({ where: { id: row.id }, data: { readAt: now } });
      }
      return "updated";
    },

    async markAllRead(userId, now) {
      await prisma.notification.updateMany({
        where: { recipientId: userId, readAt: null },
        data: { readAt: now },
      });
    },

    async unreadCount(userId) {
      return prisma.notification.count({ where: { recipientId: userId, readAt: null } });
    },
  };
}
