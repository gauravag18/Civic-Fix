"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthorization } from "@/lib/auth/authorization";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { markAllOwnedNotifications, markOwnedNotification } from "@/lib/notifications/service";

export async function markNotificationRead(formData: FormData): Promise<void> {
  const authorization = await getAuthorization();
  if (!authorization) redirect("/login");
  const id = formData.get("id");
  await markOwnedNotification(
    authorization.userId,
    typeof id === "string" ? id : "",
    createPrismaNotificationStore(),
    new Date(),
  );
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const authorization = await getAuthorization();
  if (!authorization) redirect("/login");
  await markAllOwnedNotifications(authorization.userId, createPrismaNotificationStore(), new Date());
  revalidatePath("/", "layout");
}
