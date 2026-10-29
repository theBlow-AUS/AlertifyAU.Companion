import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { TRIP_LOCATION_TASK, type Place } from './model';

export async function requestCurrentLocationPermission() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error(permission.canAskAgain
      ? 'Location access is needed for nearby alerts. You can enable it in phone settings.'
      : 'Location access is disabled. Enable it in phone settings to use nearby alerts.');
  }
}

export async function getCurrentLocationFix(requiredAccuracy = 1500): Promise<Location.LocationObject> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission is off. Enable it in phone settings to check nearby hazards.');
  const cached = await Location.getLastKnownPositionAsync({ maxAge: 90_000, requiredAccuracy });
  if (cached && Date.now() - cached.timestamp <= 90_000) return cached;
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

export async function enableTripBackgroundLocation() {
  if (Platform.OS === 'web') throw new Error('Background location monitoring requires the native app.');
  await requestCurrentLocationPermission();
  let permission = await Location.getBackgroundPermissionsAsync();
  if (!permission.granted) permission = await Location.requestBackgroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error(permission.canAskAgain
      ? 'Background location permission is needed to monitor your active trip while using navigation.'
      : 'Background location is disabled. Change it in phone settings to monitor an active trip.');
  }
}

export async function startTripBackgroundLocation() {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,
    distanceInterval: 250,
    deferredUpdatesInterval: 60_000,
    deferredUpdatesDistance: 250,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    ...(Platform.OS === 'android' ? {
      foregroundService: {
        notificationTitle: 'Alertify Trip Watch is active',
        notificationBody: 'Checking selected hazards near your current location.',
        notificationColor: '#287bb6',
        killServiceOnDestroy: true,
      },
    } : {}),
  });
}

export async function stopTripBackgroundLocation() {
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
  }
}

export async function syncTripBackgroundLocation(enabled: boolean) {
  if (!enabled) return stopTripBackgroundLocation();
  const permission = await Location.getBackgroundPermissionsAsync();
  if (!permission.granted) throw new Error('Background location permission is unavailable. Enable it from the Trip Watch screen.');
  await startTripBackgroundLocation();
}

export async function currentPlace(): Promise<Place> {
  let latitude: number, longitude: number;
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('Location is unavailable in this browser. Search for an address instead.');
    const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }));
    latitude = position.coords.latitude; longitude = position.coords.longitude;
  } else {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error(permission.canAskAgain ? 'Location permission was declined. You can search for an address instead.' : 'Location access is disabled. Enable it in phone settings, or search for an address.');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    latitude = position.coords.latitude; longitude = position.coords.longitude;
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) return { latitude, longitude, name: [address.streetNumber, address.street].filter(Boolean).join(' ') || address.city || 'Current location', detail: [address.city, address.region, address.postalCode].filter(Boolean).join(', ') };
    } catch { /* Coordinates remain usable if the OS address lookup fails. */ }
  }
  return { latitude, longitude, name: 'Current location', detail: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` };
}
