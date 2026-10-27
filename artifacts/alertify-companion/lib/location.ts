import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Place } from './model';

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
