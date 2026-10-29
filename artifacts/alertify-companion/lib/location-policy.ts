import { isCurrentTrip, type Settings, type Trip } from './model';

export function shouldRunTripLocation(settings: Settings, trip: Trip | null): boolean {
  return settings.notifications && settings.currentLocationAlerts && settings.tripBackgroundLocation && isCurrentTrip(trip);
}

export function isUsableLocation(
  fix: { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null } } | null,
  radiusKm: number,
  now = Date.now(),
): boolean {
  return !!fix && Number.isFinite(fix.timestamp) && fix.timestamp <= now + 5000 && now - fix.timestamp <= 120_000
    && Number.isFinite(fix.coords.latitude) && Math.abs(fix.coords.latitude) <= 90
    && Number.isFinite(fix.coords.longitude) && Math.abs(fix.coords.longitude) <= 180
    && fix.coords.accuracy !== null && Number.isFinite(fix.coords.accuracy)
    && fix.coords.accuracy >= 0 && fix.coords.accuracy <= Math.min(5000, radiusKm * 250);
}
