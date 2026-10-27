import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { SETTINGS_KEY, TRIP_KEY, MONITOR_KEY, type Settings, type Trip, distance, routeDistance, matchesLevel, isCurrentTrip } from './model';
import { fetchFeed } from './services';

const TASK = 'alertify-companion-incident-check';
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}
// Establish a baseline before issuing notifications, and only notify for a new
// incident or a warning-level change. Timestamp-only feed edits do not re-alert.
export async function checkForChanges() {
  if (Platform.OS === 'web') return;
  const saved = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!saved) return;
  const settings = JSON.parse(saved) as Settings;
  if (!settings.notifications) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are blocked in phone settings. Incident information is still available in the app.');
  const feed = await fetchFeed();
  const storedTrip = await AsyncStorage.getItem(TRIP_KEY);
  const trip = storedTrip ? JSON.parse(storedTrip) as Trip : null;
  const signature = JSON.stringify([settings.home, settings.radius, settings.watch, settings.homeLevel, settings.tripLevel, trip?.startedAt]);
  const old = await AsyncStorage.getItem(MONITOR_KEY);
  const previous = old ? JSON.parse(old) as { signature: string; seen: string[] } : null;
  const matches = feed.incidents.filter(incident =>
    (settings.watch && settings.home && distance(settings.home, incident) <= settings.radius && matchesLevel(incident, settings.homeLevel)) ||
    (isCurrentTrip(trip) && routeDistance(incident, trip.coordinates) <= 5 && matchesLevel(incident, settings.tripLevel)));
  const keys = matches.map(i => `${i.id}:${i.category}`);
  const hour = new Date().getHours();
  const quiet = settings.quietHours && (settings.quietStart < settings.quietEnd
    ? hour >= settings.quietStart && hour < settings.quietEnd
    : hour >= settings.quietStart || hour < settings.quietEnd);
  if (!quiet && previous?.signature === signature) {
    const fresh = matches.filter((_, index) => !previous.seen.includes(keys[index])).slice(0, 5);
    for (const incident of fresh) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${incident.category} · ${incident.type}`,
          body: `${incident.title}. Check NSW RFS for current instructions.`,
          sound: 'default', data: { incidentId: incident.id },
        },
        trigger: null,
      });
    }
  }
  await AsyncStorage.setItem(MONITOR_KEY, JSON.stringify({ signature, seen: keys, checkedAt: Date.now() }));
}
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask(TASK, async () => {
    try { await checkForChanges(); return BackgroundTask.BackgroundTaskResult.Success; }
    catch { return BackgroundTask.BackgroundTaskResult.Failed; }
  });
}
export async function enableNotifications() {
  if (Platform.OS === 'web') throw new Error('Use the native iPhone or Android app to enable on-device notifications.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Incident updates', importance: Notifications.AndroidImportance.HIGH });
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are not allowed. You can enable them in your phone settings.');
}
export async function setBackgroundChecks(enabled: boolean) {
  if (Platform.OS === 'web') throw new Error('Background checks require the native app.');
  if (!enabled) {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
    return;
  }
  if (!await TaskManager.isAvailableAsync() || await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) {
    throw new Error('Background refresh is unavailable in this preview or disabled on your device. Foreground checks still work. A native build and Background App Refresh may be required.');
  }
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
