export type Level = 'urgent' | 'significant' | 'all';
export type NavigationApp = 'Google Maps' | 'Waze';
export type Place = { name: string; detail: string; latitude: number; longitude: number };
export type Settings = {
  home: Place | null; radius: number; watch: boolean;
  homeLevel: Level; tripLevel: Level; navigationApp: NavigationApp | null;
  notifications: boolean; background: boolean;
  quietHours: boolean; quietStart: number; quietEnd: number;
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
export const defaultSettings: Settings = {
  home: null, radius: 10, watch: true, homeLevel: 'significant',
  tripLevel: 'significant', navigationApp: null, notifications: false, background: false,
  quietHours: false, quietStart: 22, quietEnd: 7,
};
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
