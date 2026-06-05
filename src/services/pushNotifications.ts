import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { usersAPI } from './api';

// Configure foreground notification behaviour: show banner + play sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission and register the device's Expo push token with our backend.
 * Call this once after successful sign-in.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[push] Push notifications require a physical device.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[push] Push notification permission not granted.');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DA Consulting',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00D598',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Register with our backend
    await usersAPI.registerPushToken(token);
    return token;
  } catch (err) {
    console.error('[push] Failed to get or register push token:', err);
    return null;
  }
}

/**
 * Remove the push token from the backend on sign-out.
 */
export async function deregisterPushToken(): Promise<void> {
  try {
    await usersAPI.deregisterPushToken();
  } catch {}
}

/**
 * Add a listener that fires when the user taps a notification.
 * Pass a handler that receives the notification data and navigates accordingly.
 */
export function addNotificationResponseListener(
  handler: (data: Record<string, any>) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, any>;
    handler(data ?? {});
  });
}

/**
 * Add a listener for notifications received while the app is in the foreground.
 */
export function addForegroundNotificationListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}
