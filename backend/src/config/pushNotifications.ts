import { prisma } from './database';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send an Expo push notification to a user by their DB user ID.
 * Silently no-ops if the user has no push token or if the token is invalid.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } });
    if (!user?.expoPushToken) return;

    await sendPushToToken(user.expoPushToken, msg);
  } catch (err) {
    console.error('[push] sendPushToUser error:', err);
  }
}

/**
 * Send an Expo push notification directly to a push token.
 */
export async function sendPushToToken(token: string, msg: PushMessage): Promise<void> {
  if (!token.startsWith('ExponentPushToken[')) return;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: msg.title,
        body: msg.body,
        data: msg.data ?? {},
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[push] Expo API error:', err);
    }
  } catch (err) {
    console.error('[push] sendPushToToken error:', err);
  }
}

/**
 * Send a push to multiple user IDs at once (batched via Expo bulk API).
 */
export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    });

    const tokens = users
      .map(u => u.expoPushToken!)
      .filter(t => t.startsWith('ExponentPushToken['));

    if (tokens.length === 0) return;

    const messages = tokens.map(to => ({
      to,
      title: msg.title,
      body: msg.body,
      data: msg.data ?? {},
      sound: 'default',
      priority: 'high',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[push] sendPushToUsers error:', err);
  }
}
