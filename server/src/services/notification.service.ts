import type { DbClient } from '../config/database.js';
import type { NotificationType, Prisma } from '../generated/prisma/client.js';

interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonObject;
}

/** Creates an in-app notification. (The notification centre API arrives in Phase 10.) */
export async function createNotification(
  db: DbClient,
  notification: NewNotification,
): Promise<void> {
  await db.notification.create({
    data: {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      ...(notification.data ? { data: notification.data } : {}),
    },
  });
}
