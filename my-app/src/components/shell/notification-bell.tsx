import { getAuthorization } from "@/lib/auth/authorization";
import { formatWhen } from "@/lib/issues/labels";
import { NotificationPanel, type PanelNotice } from "@/components/shell/notification-panel";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { listUserNotifications, notificationHref } from "@/lib/notifications/service";

export async function NotificationBell() {
  const authorization = await getAuthorization();
  if (!authorization) return null;
  const result = await listUserNotifications(authorization.userId, 1, createPrismaNotificationStore());
  if (!result.ok) {
    return <NotificationPanel unread={0} items={[]} />;
  }
  const items: PanelNotice[] = result.items.slice(0, 5).map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    href: notificationHref(item),
    when: `${formatWhen(item.createdAt)} UTC`,
    iso: item.createdAt.toISOString(),
    unread: item.readAt === null,
  }));
  return <NotificationPanel unread={result.unread} items={items} />;
}
