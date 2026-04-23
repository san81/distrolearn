/**
 * DistroLearn — Local Notifications Service
 *
 * Schedules a daily streak reminder at a user-chosen time (default 9am).
 * Cancelled and rescheduled each time the user completes a session,
 * so they don't get notified on days they've already practiced.
 *
 * Call order:
 *   1. requestNotificationPermission() — on first launch / after onboarding
 *   2. scheduleDailyReminder()         — after each session completes
 *   3. cancelDailyReminder()           — (optional) if user opts out
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFICATION_ID_KEY = 'distrolearn_notif_id';
const REMINDER_HOUR_KEY   = 'distrolearn_reminder_hour';
const REMINDER_MIN_KEY    = 'distrolearn_reminder_min';

const DEFAULT_HOUR   = 9;
const DEFAULT_MINUTE = 0;

// Show alerts even when app is foregrounded (for testing)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
});

// ── Permissions ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name:       'Daily Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Schedule ──────────────────────────────────────────────────────────────────

/**
 * Schedules (or reschedules) the daily reminder.
 * Safe to call after every session — it cancels the previous one first.
 */
export async function scheduleDailyReminder(
  hour   = DEFAULT_HOUR,
  minute = DEFAULT_MINUTE,
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancel existing
  await cancelDailyReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔥 Keep your streak alive!',
      body:  "Your daily distributed systems cards are ready. Don't break the chain.",
      data:  { type: 'daily_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
  await AsyncStorage.setItem(REMINDER_HOUR_KEY,   String(hour));
  await AsyncStorage.setItem(REMINDER_MIN_KEY,    String(minute));
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export async function cancelDailyReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
  }
}

// ── Settings helpers ──────────────────────────────────────────────────────────

export async function getReminderTime(): Promise<{ hour: number; minute: number }> {
  const h = await AsyncStorage.getItem(REMINDER_HOUR_KEY);
  const m = await AsyncStorage.getItem(REMINDER_MIN_KEY);
  return {
    hour:   h ? parseInt(h, 10) : DEFAULT_HOUR,
    minute: m ? parseInt(m, 10) : DEFAULT_MINUTE,
  };
}

export async function isReminderScheduled(): Promise<boolean> {
  const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
  return !!id;
}
