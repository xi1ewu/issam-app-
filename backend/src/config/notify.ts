/**
 * Central notification dispatcher.
 * Creates a Notification DB record AND sends an Expo push — one call does both.
 */
import { prisma } from './database';
import { sendPushToUser } from './pushNotifications';
import { getIO } from './socketSingleton';

export type NotifType =
  | 'MESSAGE'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_DECLINED'
  | 'BOOKING_NEW'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_SUCCESS'
  | 'REVIEW_NEW'
  | 'EXPERT_SAVED'
  | 'BAN'
  | 'SYSTEM';

interface NotifyOptions {
  userId: string;
  type: NotifType;
  title: string;
  message: string;
  /** Raw data stored in the Notification row and forwarded to the push payload */
  data?: Record<string, any>;
  /** Sender display name shown in the notification row */
  senderName?: string;
  senderAvatar?: string;
  /** Skip push (DB-only record) */
  pushOnly?: false;
}

export async function notify(opts: NotifyOptions): Promise<void> {
  const { userId, type, title, message, data, senderName, senderAvatar } = opts;

  // Write DB record (fire-and-forget)
  prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ?? {},
      senderName:   senderName   ?? null,
      senderAvatar: senderAvatar ?? null,
    },
  }).then(row => {
    // Emit real-time socket event so the frontend badge updates instantly
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', {
        id:          row.id,
        type,
        title,
        message,
        senderName:   senderName   ?? null,
        senderAvatar: senderAvatar ?? null,
        data:         data ?? {},
        isRead:       false,
        createdAt:    row.createdAt,
      });
    }
  }).catch(e => console.error('[notify] DB write failed:', e));

  // Send push
  sendPushToUser(userId, { title, body: message, data: { ...data, type } });
}

/** Convenience — notify multiple users at once */
export async function notifyMany(
  userIds: string[],
  opts: Omit<NotifyOptions, 'userId'>
): Promise<void> {
  await Promise.all(userIds.map(uid => notify({ ...opts, userId: uid })));
}
