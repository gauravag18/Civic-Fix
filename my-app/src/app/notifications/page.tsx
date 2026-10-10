import Link from "next/link";
import { AppPage } from "@/components/app-page";
import { Button } from "@/components/ui/button";
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
  const lede =
    result.unread > 0
      ? `${result.unread} unread of ${result.total}.`
      : result.total > 0
        ? "You are up to date."
        : "Updates about your reports and department assignments.";

  return (
    <AppPage title="Notifications" lede={lede}>
      {result.total === 0 ? (
        <div className="rounded-md border border-border bg-card px-4 py-8">
          <p className="font-semibold">No notifications yet.</p>
          <p className="mt-2 text-muted-foreground">
            Status changes, assignments, and comments will appear here.
          </p>
        </div>
      ) : null}
      {result.unread > 0 ? (
        <form action={markAllNotificationsRead}>
          <Button type="submit" variant="secondary">
            Mark all as read
          </Button>
        </form>
      ) : null}
      <ol className="flex flex-col gap-3">
        {result.items.map((item) => {
          const href = notificationHref(item);
          const unread = item.readAt === null;
          return (
            <li
              key={item.id}
              className={
                unread
                  ? "rounded-md border border-border border-l-4 border-l-accent bg-card px-4 py-4"
                  : "rounded-md border border-border bg-card px-4 py-4"
              }
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 max-w-prose text-muted-foreground">{item.body}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                <time dateTime={item.createdAt.toISOString()}>{formatWhen(item.createdAt)} UTC</time>
                {unread ? " · Unread" : " · Read"}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                {href ? <Link href={href}>Open report</Link> : null}
                {unread ? (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Mark as read
                    </Button>
                  </form>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
      {result.total > result.pageSize ? (
        <nav aria-label="Notification pages" className="flex flex-wrap items-center gap-4 text-sm">
          <p>
            Page {result.page} of {lastPage}
          </p>
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
