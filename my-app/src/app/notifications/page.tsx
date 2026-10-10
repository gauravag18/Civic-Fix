import Link from "next/link";
import { AppPage } from "@/components/app-page";
import { getAuthorization } from "@/lib/auth/authorization";
import { formatWhen } from "@/lib/issues/labels";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { listUserNotifications, notificationHref } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  let userId: string | null = null;
  try {
    userId = (await getAuthorization())?.userId ?? null;
  } catch {
    return (
      <AppPage title="Notifications">
        <p role="alert">Notifications could not be loaded.</p>
      </AppPage>
    );
  }
  const result = await listUserNotifications(userId, query.page, createPrismaNotificationStore());

  if (!result.ok && result.reason === "signed-out") {
    return (
      <AppPage title="Notifications" lede="Sign in to read notifications for your account.">
        <p>
          Sign in to see notifications for your account. <Link href="/login">Log in</Link>
        </p>
      </AppPage>
    );
  }
  if (!result.ok) {
    return (
      <AppPage title="Notifications">
        <p role="alert">Notifications could not be loaded.</p>
      </AppPage>
    );
  }

  const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <AppPage title="Notifications" lede="Updates about your reports and department assignments.">
      {result.total === 0 ? <p>No notifications yet.</p> : null}
      {result.unread > 0 ? (
        <form action={markAllNotificationsRead}>
          <button type="submit" className="text-small underline">
            Mark all as read
          </button>
        </form>
      ) : null}
      <ol className="flex flex-col gap-4">
        {result.items.map((item) => {
          const href = notificationHref(item);
          return (
            <li key={item.id} className="border-b border-border pb-4">
              <p className="font-semibold">{item.title}</p>
              <p className="max-w-prose text-body">{item.body}</p>
              <p className="text-small text-muted-foreground">
                <time dateTime={item.createdAt.toISOString()}>{formatWhen(item.createdAt)} UTC</time>
                {item.readAt ? " · Read" : " · Unread"}
              </p>
              <p className="mt-2 flex flex-wrap gap-3 text-small">
                {href ? <Link href={href}>Open report</Link> : null}
                {item.readAt ? null : (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="underline">
                      Mark as read
                    </button>
                  </form>
                )}
              </p>
            </li>
          );
        })}
      </ol>
      {result.total > result.pageSize ? (
        <nav aria-label="Notification pages" className="flex gap-4 text-small">
          {result.page > 1 ? (
            <Link href={result.page === 2 ? "/notifications" : `/notifications?page=${result.page - 1}`}>
              Previous
            </Link>
          ) : null}
          {result.page < lastPage ? (
            <Link href={`/notifications?page=${result.page + 1}`}>Next</Link>
          ) : null}
        </nav>
      ) : null}
    </AppPage>
  );
}
