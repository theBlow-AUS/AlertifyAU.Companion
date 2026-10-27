import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { SETTINGS_KEY, TRIP_KEY, MONITOR_KEY, normalizeSettings, type Trip, distance, routeDistance, matchesLevel, isCurrentTrip } from './model';
import { fetchFeed } from './services';
import { advanceHazardMonitor, advanceMonitor, type HazardMonitorState, type MonitorState } from './monitor-state';
import { collectHazardSnapshots } from './hazard-monitor';

const TASK = 'alertify-companion-incident-check';
const HAZARD_MONITOR_KEY = 'alertify.hazard-alert-monitor.v1';
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}
// Establish a baseline before issuing notifications, and only notify for a new
// incident or a warning-level change. Timestamp-only feed edits do not re-alert.
let pendingCheck: Promise<void> | null = null;
export function checkForChanges(): Promise<void> {
  if (pendingCheck) return pendingCheck;
  pendingCheck = runCheck().finally(() => { pendingCheck = null; });
  return pendingCheck;
}
async function runCheck() {
  if (Platform.OS === 'web') return;
  const saved = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!saved) return;
  const settings = normalizeSettings(JSON.parse(saved));
  if (!settings.notifications) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are blocked in phone settings. Incident information is still available in the app.');
  const storedTrip = await AsyncStorage.getItem(TRIP_KEY);
  const trip = storedTrip ? JSON.parse(storedTrip) as Trip : null;
  const [feedResult, sourceResult] = await Promise.allSettled([
    fetchFeed(), collectHazardSnapshots(settings, trip),
  ]);
  const feed = feedResult.status === 'fulfilled' ? feedResult.value : null;
  const old = await AsyncStorage.getItem(MONITOR_KEY);
  const previous = old ? JSON.parse(old) as MonitorState : null;
  const advanced = feed ? advanceMonitor(settings, trip, feed.incidents, previous) : null;
  const oldHazards = await AsyncStorage.getItem(HAZARD_MONITOR_KEY);
  const previousHazards = oldHazards ? JSON.parse(oldHazards) as HazardMonitorState : null;
  const checkedSources = sourceResult.status === 'fulfilled' ? sourceResult.value : { snapshots: [], errors: ['Selected hazard feeds could not be checked.'] };
  const advancedHazards = advanceHazardMonitor(checkedSources.snapshots, previousHazards);
  const delivery = new Map<string, { title: string; body: string; data: Record<string, string> }>();
  if (advanced && settings.alertHazards.rfs) for (const incident of advanced.fresh.slice(0, 5)) {
    const names = settings.watch ? settings.watches.filter(w => w.enabled && distance(w.place, incident) <= w.radius).map(w => w.label) : [];
    delivery.set(`rfs:${incident.id}`, {
      title: `${incident.category} · ${incident.type}`,
      body: `${names.length ? `${names.join(', ')} · ` : 'Trip Watch · '}${incident.title}. Check NSW RFS for current instructions.`,
      data: { incidentId: incident.id, hazardSource: 'rfs' },
    });
  }
  for (const source of [...new Set(advancedHazards.fresh.map(alert => alert.source))]) {
    const alerts = advancedHazards.fresh.filter(alert => alert.source === source);
    if (!alerts.length) continue;
    const labels = [...new Set(alerts.flatMap(alert => alert.scopeLabels))].slice(0, 3);
    const extraLabels = Math.max(0, new Set(alerts.flatMap(alert => alert.scopeLabels)).size - labels.length);
    const names: Record<string, string> = { fireDanger: 'Fire danger', tfnsw: 'TfNSW hazards', bom: 'BOM warnings', ses: 'SES HazardWatch', lightning: 'Xweather lightning', hail: 'Xweather hail', wind: 'Xweather wind', rain: 'Xweather rain' };
    const titles = alerts.slice(0, 3).map(alert => `${alert.title} · ${alert.body}`);
    const suffix = alerts.length > titles.length ? `, and ${alerts.length - titles.length} more` : '';
    delivery.set(`${source}:${alerts.map(alert => alert.id).join('|')}`, {
      title: alerts.length === 1 ? alerts[0].title : `${names[source] ?? source} · ${alerts.length} updates`,
      body: `${labels.join(', ')}${extraLabels ? ` +${extraLabels} more` : ''}: ${titles.join('; ')}${suffix}`,
      data: { hazardSource: source },
    });
  }
  const hour = new Date().getHours();
  const quiet = settings.quietHours && (settings.quietStart < settings.quietEnd
    ? hour >= settings.quietStart && hour < settings.quietEnd
    : hour >= settings.quietStart || hour < settings.quietEnd);
  if (!quiet) {
    for (const alert of [...delivery.values()].slice(0, 13)) await Notifications.scheduleNotificationAsync({
      content: { ...alert, sound: 'default' }, trigger: null,
    });
  }
  if (advanced) await AsyncStorage.setItem(MONITOR_KEY, JSON.stringify({ ...advanced.state, checkedAt: Date.now() }));
  await AsyncStorage.setItem(HAZARD_MONITOR_KEY, JSON.stringify({ ...advancedHazards.state, checkedAt: Date.now() }));
  const errors = [...(feedResult.status === 'rejected' ? ['NSW RFS incidents could not be checked.'] : []), ...checkedSources.errors];
  if (errors.length) throw new Error([...new Set(errors)].slice(0, 3).join(' '));
}
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask(TASK, async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved && JSON.parse(saved).background) await checkForChanges();
      return BackgroundTask.BackgroundTaskResult.Success;
    }
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
