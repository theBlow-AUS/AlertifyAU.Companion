export type Level = 'urgent' | 'significant' | 'all';
export type NavigationApp = 'Google Maps' | 'Waze';
export type AlertHazardKey = 'rfs' | 'fireDanger' | 'tfnsw' | 'bom' | 'ses' | 'lightning' | 'hail' | 'wind' | 'rain';
export type AlertHazards = Record<AlertHazardKey, boolean>;
export const defaultAlertHazards: AlertHazards = {
  rfs: true, fireDanger: true, tfnsw: true, bom: true, ses: true,
  lightning: true, hail: true, wind: true, rain: true,
};
const legacyAlertHazards: AlertHazards = { ...defaultAlertHazards, fireDanger: false, tfnsw: false, bom: false, ses: false, lightning: false, hail: false, wind: false, rain: false };
export const alertHazardOptions: { key: AlertHazardKey; label: string; detail: string }[] = [
  { key: 'rfs', label: 'NSW RFS incidents', detail: 'Uses Home and Trip sensitivity.' },
  { key: 'fireDanger', label: 'Fire danger rating changes', detail: 'A pin’s district rating or total fire ban changes.' },
  { key: 'tfnsw', label: 'TfNSW live hazards', detail: 'Reports need a mapped location near a watch zone or trip.' },
  { key: 'bom', label: 'BOM NSW warnings', detail: 'The current feed is statewide and not geocoded.' },
  { key: 'ses', label: 'NSW SES HazardWatch', detail: 'Only reports with a usable location can be matched.' },
  { key: 'lightning', label: 'Xweather lightning', detail: 'Strikes matched to a watch zone or trip.' },
  { key: 'hail', label: 'Xweather hail threats', detail: 'Forecast areas intersecting a watch zone or trip.' },
  { key: 'wind', label: 'Xweather strong wind', detail: 'Gusts at or above your advisory threshold below.' },
  { key: 'rain', label: 'Xweather heavy rain', detail: 'Forecast peak hourly rate at or above your advisory threshold below.' },
];
export const advisoryThresholdLimits = {
  windGustThresholdKph: { min: 10, max: 300, defaultValue: 90, label: 'Wind gusts', unit: 'km/h' },
  rainThresholdMmH: { min: 1, max: 200, defaultValue: 20, label: 'Hourly rainfall', unit: 'mm/hour' },
} as const;
export type AdvisoryThresholdKey = keyof typeof advisoryThresholdLimits;
function normalizeThreshold(key: AdvisoryThresholdKey, value: unknown): number {
  const { min, max, defaultValue, label, unit } = advisoryThresholdLimits[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max} ${unit}. Saved preferences have not been changed.`);
  }
  return value;
}
export const currentLocationRadiusLimits = { min: 1, max: 50, defaultValue: 10 } as const;
function normalizeCurrentLocationRadius(value: unknown): number {
  const { min, max, defaultValue } = currentLocationRadiusLimits;
  if (value === undefined) return defaultValue;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Current-location alert radius must be a whole number from ${min} to ${max} km. Saved preferences have not been changed.`);
  }
  return value;
}
export type Place = { name: string; detail: string; latitude: number; longitude: number };
export type WatchAddress = {
  id: string; label: string; place: Place; radius: number; enabled: boolean;
};
export type Settings = {
  home: Place | null; radius: number; watch: boolean;
  watches: WatchAddress[]; activeWatchId: string | null;
  homeLevel: Level; tripLevel: Level; navigationApp: NavigationApp | null;
  alertHazards: AlertHazards;
  currentLocationAlerts: boolean; currentLocationRadiusKm: number; tripBackgroundLocation: boolean;
  windGustThresholdKph: number; rainThresholdMmH: number;
  notifications: boolean; background: boolean;
  quietHours: boolean; quietStart: number; quietEnd: number;
};
export type LiveLocationStatus = {
  lastLocationAt: number | null;
  lastCheckAt: number | null;
  error: string | null;
};
export type Incident = {
  id: string; title: string; category: string; severity: number;
  latitude: number; longitude: number; location: string; council: string;
  status: string; type: string; updated: string; sourceUrl: string; description: string;
};
export type Feed = { incidents: Incident[]; fetchedAt: number };
export type RouteEstimate = {
  start: Place; destination: Place; coordinates: [number, number][];
  distance: number; duration: number; calculatedAt: number;
};
export type Trip = RouteEstimate & { startedAt: number };
export const SETTINGS_KEY = 'alertify.settings.v1';
export const TRIP_KEY = 'alertify.trip.v1';
export const FEED_KEY = 'alertify.feed.v1';
export const MONITOR_KEY = 'alertify.monitor.v1';
export const LIVE_LOCATION_STATUS_KEY = 'alertify.live-location-status.v1';
export const TRIP_LOCATION_TASK = 'alertify-companion-trip-location';
export const defaultSettings: Settings = {
  home: null, radius: 10, watch: true, homeLevel: 'significant',
  watches: [], activeWatchId: null,
  tripLevel: 'significant', navigationApp: null, notifications: false, background: false,
  currentLocationAlerts: false, currentLocationRadiusKm: currentLocationRadiusLimits.defaultValue, tripBackgroundLocation: false,
  alertHazards: defaultAlertHazards,
  windGustThresholdKph: advisoryThresholdLimits.windGustThresholdKph.defaultValue,
  rainThresholdMmH: advisoryThresholdLimits.rainThresholdMmH.defaultValue,
  quietHours: false, quietStart: 22, quietEnd: 7,
};
export function normalizeSettings(raw: Partial<Settings>): Settings {
  const base = { ...defaultSettings, ...raw };
  const windGustThresholdKph = normalizeThreshold('windGustThresholdKph', raw.windGustThresholdKph);
  const rainThresholdMmH = normalizeThreshold('rainThresholdMmH', raw.rainThresholdMmH);
  const currentLocationRadiusKm = normalizeCurrentLocationRadius(raw.currentLocationRadiusKm);
  const alertHazards = raw.alertHazards && typeof raw.alertHazards === 'object'
    ? { ...defaultAlertHazards, ...raw.alertHazards }
    : legacyAlertHazards;
  const watches = Array.isArray(raw.watches) ? raw.watches : raw.home
    ? [{ id: 'saved-home', label: 'Home', place: raw.home, radius: raw.radius || 10, enabled: true }]
    : [];
  // Older builds stored a manually chosen district. Strip it: fire weather
  // areas now follow the address pin matched against Alertify's LGA boundaries.
  const migratedWatches = watches.map(w => {
    const { fireDistrict: _legacyDistrict, ...watch } = w as WatchAddress & { fireDistrict?: string | null };
    return watch;
  });
  if (migratedWatches.some(w => !w.id || !w.label || !w.place || !Number.isFinite(w.place.latitude) || !Number.isFinite(w.place.longitude) || !Number.isFinite(w.radius) || w.radius <= 0)) {
    throw new Error('A saved watch address is invalid. Existing saved data has not been overwritten.');
  }
  const active = migratedWatches.find(w => w.id === raw.activeWatchId) ?? migratedWatches[0];
  return {
    ...base,
    currentLocationAlerts: raw.currentLocationAlerts === true,
    currentLocationRadiusKm,
    tripBackgroundLocation: raw.tripBackgroundLocation === true,
    windGustThresholdKph, rainThresholdMmH, alertHazards,
    watches: migratedWatches, activeWatchId: active?.id ?? null, home: active?.place ?? null, radius: active?.radius ?? 10,
  };
}
export const levels: { value: Level; label: string; detail: string }[] = [
  { value: 'urgent', label: 'Urgent only', detail: 'Emergency Warnings only.' },
  { value: 'significant', label: 'Significant', detail: 'Watch and Act plus Emergency Warnings.' },
  { value: 'all', label: 'All relevant', detail: 'All nearby RFS incidents, including Advice and planned burns.' },
];
export const RFS_URL = 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me';
export const DANGER_URL = 'https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans';
export const isCurrentTrip = (trip: Trip | null): trip is Trip => !!trip && Date.now() - trip.startedAt < 24 * 60 * 60 * 1000;
export function distance(a: Pick<Place, 'latitude' | 'longitude'>, b: Pick<Place, 'latitude' | 'longitude'>) {
  const rad = Math.PI / 180;
  const dlat = (b.latitude - a.latitude) * rad;
  const dlon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function routeDistance(incident: Pick<Place, 'latitude' | 'longitude'>, coordinates: [number, number][]) {
  let min = Infinity;
  const scale = Math.cos(incident.latitude * Math.PI / 180);
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    const ax = (a[0] - incident.longitude) * scale * 111.32, ay = (a[1] - incident.latitude) * 111.32;
    const bx = (b[0] - incident.longitude) * scale * 111.32, by = (b[1] - incident.latitude) * 111.32;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}
export const matchesLevel = (incident: Incident, level: Level) => incident.severity >= (level === 'urgent' ? 3 : level === 'significant' ? 2 : 0);
export const timeAgo = (at: number) => {
  const mins = Math.max(0, Math.floor((Date.now() - at) / 60000));
  return mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`;
};
export function navigationUrl(app: NavigationApp, destination: Place, start?: Place) {
  return app === 'Waze'
    ? `https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}${start ? `&origin=${start.latitude},${start.longitude}` : ''}&travelmode=driving`;
}
