import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { SETTINGS_KEY, TRIP_KEY, MONITOR_KEY, LIVE_LOCATION_STATUS_KEY, TRIP_LOCATION_TASK, normalizeSettings, type LiveLocationStatus, type Trip, distance, routeDistance, matchesLevel, isCurrentTrip } from './model';
import { fetchFeed } from './services';
import { advanceHazardMonitor, advanceMonitor, type HazardMonitorState, type MonitorState } from './monitor-state';
import { collectHazardSnapshots } from './hazard-monitor';
import { getCurrentLocationFix, stopTripBackgroundLocation } from './location';
import { updateLiveLocationStatus } from './live-location-status';
import { isUsableLocation, shouldRunTripLocation } from './location-policy';

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
let latestCurrentLocation: Location.LocationObject | null = null;
let queuedCurrentLocation: Location.LocationObject | null = null;
let lastBackgroundLocationCheck = 0;
export function checkForChanges(locationFix?: Location.LocationObject): Promise<void> {
  if (locationFix) latestCurrentLocation = locationFix;
  if (pendingCheck) {
    if (locationFix) queuedCurrentLocation = locationFix;
    return pendingCheck;
  }
  pendingCheck = runCheck().finally(() => {
    pendingCheck = null;
    if (queuedCurrentLocation) {
      const queued = queuedCurrentLocation;
      queuedCurrentLocation = null;
      void checkForChanges(queued).catch(error => {
        void updateLiveLocationStatus({ error: error instanceof Error ? error.message : 'A nearby hazard check failed.' }).catch(() => undefined);
      });
    }
  });
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
  let currentFix = latestCurrentLocation;
  let locationError: string | null = null;
  let currentPoint: { latitude: number; longitude: number } | null = null;
  if (settings.currentLocationAlerts) {
    const maxAccuracy = Math.min(5000, settings.currentLocationRadiusKm * 250);
    const locationPermission = await Location.getForegroundPermissionsAsync();
    if (!locationPermission.granted) {
      currentFix = null;
      latestCurrentLocation = null;
      locationError = 'Location permission is off. Nearby-current-location checks are paused; review phone settings.';
    }
    if (!isUsableLocation(currentFix, settings.currentLocationRadiusKm)) currentFix = null;
    if (!currentFix && locationPermission.granted && AppState.currentState === 'active') {
      try { currentFix = await getCurrentLocationFix(maxAccuracy); }
      catch (error) { locationError = error instanceof Error ? error.message : 'A fresh device location is unavailable.'; }
    }
    if (currentFix && isUsableLocation(currentFix, settings.currentLocationRadiusKm)) {
      latestCurrentLocation = currentFix;
      currentPoint = { latitude: currentFix.coords.latitude, longitude: currentFix.coords.longitude };
    } else {
      currentFix = null;
      locationError ??= 'A fresh, accurate location is unavailable. Nearby-current-location checks are paused.';
    }
  }
  const [feedResult, sourceResult] = await Promise.allSettled([
    fetchFeed(), collectHazardSnapshots(settings, trip, currentPoint),
  ]);
  const feed = feedResult.status === 'fulfilled' ? feedResult.value : null;
  const old = await AsyncStorage.getItem(MONITOR_KEY);
  const previous = old ? JSON.parse(old) as MonitorState : null;
  const advanced = feed ? advanceMonitor(settings, trip, feed.incidents, previous, currentPoint) : null;
  const oldHazards = await AsyncStorage.getItem(HAZARD_MONITOR_KEY);
  const previousHazards = oldHazards ? JSON.parse(oldHazards) as HazardMonitorState : null;
  const checkedSources = sourceResult.status === 'fulfilled' ? sourceResult.value : { snapshots: [], errors: ['Selected hazard feeds could not be checked.'] };
  const advancedHazards = advanceHazardMonitor(checkedSources.snapshots, previousHazards);
  const delivery = new Map<string, { title: string; body: string; data: Record<string, string> }>();
  if (advanced && settings.alertHazards.rfs) for (const incident of advanced.fresh.slice(0, 5)) {
    const names = settings.watch ? settings.watches.filter(w => w.enabled && distance(w.place, incident) <= w.radius).map(w => w.label) : [];
    if (currentPoint && distance(currentPoint, incident) <= settings.currentLocationRadiusKm) names.push('Near your current location');
    if (isCurrentTrip(trip) && routeDistance(incident, trip.coordinates) <= 5) names.push('Trip Watch route');
    delivery.set(`rfs:${incident.id}`, {
      title: `${incident.category} · ${incident.type}`,
      body: `${names.length ? `${[...new Set(names)].join(', ')} · ` : 'Nearby · '}${incident.title}. Check NSW RFS for current instructions.`,
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
  const errors = [...(feedResult.status === 'rejected' ? ['NSW RFS incidents could not be checked.'] : []), ...checkedSources.errors, ...(locationError ? [locationError] : [])];
  const previousStatusRaw = await AsyncStorage.getItem(LIVE_LOCATION_STATUS_KEY);
  const previousStatus = previousStatusRaw ? JSON.parse(previousStatusRaw) as LiveLocationStatus : null;
  await AsyncStorage.setItem(LIVE_LOCATION_STATUS_KEY, JSON.stringify({
    lastLocationAt: currentPoint && currentFix ? currentFix.timestamp : previousStatus?.lastLocationAt ?? null,
    lastCheckAt: Date.now(),
    error: errors.length ? [...new Set(errors)].slice(0, 3).join(' ') : null,
  }));
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
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(TRIP_LOCATION_TASK)) {
  TaskManager.defineTask(TRIP_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      await updateLiveLocationStatus({ error: 'The operating system could not provide a background location update.' });
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;
    latestCurrentLocation = latest;
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      const tripJson = await AsyncStorage.getItem(TRIP_KEY);
      if (!saved || !tripJson) {
        await stopTripBackgroundLocation();
        return;
      }
      const settings = normalizeSettings(JSON.parse(saved));
      const trip = JSON.parse(tripJson) as Trip;
      if (!shouldRunTripLocation(settings, trip)) {
        await stopTripBackgroundLocation();
        return;
      }
      // iOS can batch location events. Avoid fetching every feed for each event.
      if (Date.now() - lastBackgroundLocationCheck < 60_000) return;
      lastBackgroundLocationCheck = Date.now();
      await checkForChanges(latest);
    } catch (taskError) {
      await updateLiveLocationStatus({
        lastLocationAt: latest.timestamp,
        error: taskError instanceof Error ? taskError.message : 'Background hazard checks could not complete.',
      });
    }
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
