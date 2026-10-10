import Link from "next/link";
import { getAuthorization } from "@/lib/auth/authorization";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";

export async function NotificationLink() {
  let authorization: Awaited<ReturnType<typeof getAuthorization>> = null;
  try {
    authorization = await getAuthorization();
  } catch {
    return null;
  }
  if (!authorization) return null;
  let unread = 0;
  try {
    unread = await createPrismaNotificationStore().unreadCount(authorization.userId);
  } catch {
    unread = 0;
  }
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <>
      {" · "}
      <Link href="/notifications" aria-label={label}>
        {unread > 0 ? `Notifications (${unread})` : "Notifications"}
      </Link>
    </>
  );
}
