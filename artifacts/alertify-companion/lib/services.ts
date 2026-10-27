import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEED_KEY, type Feed, type Incident, type Place, type RouteEstimate } from './model';

async function request(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Data source returned ${response.status}. Please try again.`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The data source timed out. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
type Geometry = { type: string; coordinates?: unknown; geometries?: Geometry[] };
function locationOf(geometry: Geometry): [number, number] | null {
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) return geometry.coordinates as [number, number];
  for (const child of geometry.geometries ?? []) {
    const point = locationOf(child);
    if (point) return point;
  }
  return null;
}
function clean(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
}
export function parseIncidents(raw: unknown): Incident[] {
  if (!raw || typeof raw !== 'object' || !('features' in raw) || !Array.isArray(raw.features)) throw new Error('The RFS feed has an unexpected format.');
  return raw.features.flatMap((feature: { geometry: Geometry; properties: Record<string, unknown> }) => {
    if (!feature.geometry || !feature.properties) return [];
    const point = locationOf(feature.geometry);
    if (!point || !point.every(Number.isFinite)) return [];
    const p = feature.properties;
    const description = String(p.description ?? '');
    const fields: Record<string, string> = {};
    description.split(/<br\s*\/?>/i).forEach(row => {
      const match = row.match(/^\s*([^:]+):\s*(.*)$/s);
      if (match) fields[clean(match[1]).toUpperCase()] = clean(match[2]);
    });
    const category = String(p.category ?? fields['ALERT LEVEL'] ?? 'Not available');
    const severity = /emergency/i.test(category) ? 3 : /watch.*act/i.test(category) ? 2 : /^advice$/i.test(category) ? 1 : 0;
    return [{
      id: String(p.guid ?? `${point[0]},${point[1]}-${p.title}`),
      title: clean(String(p.title ?? 'RFS incident')), category, severity,
      longitude: point[0], latitude: point[1],
      location: fields.LOCATION || 'Location not supplied', council: fields['COUNCIL AREA'] || '',
      status: fields.STATUS || 'Not supplied', type: fields.TYPE || 'Incident',
      updated: fields.UPDATED || String(p.pubDate ?? 'Not supplied'),
      sourceUrl: 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me',
      description: clean(description.replace(/<br\s*\/?>/gi, '\n')),
    }];
  });
}
export async function fetchFeed(): Promise<Feed> {
  const raw = await request('https://www.rfs.nsw.gov.au/feeds/majorIncidents.json');
  const feed = { incidents: parseIncidents(raw), fetchedAt: Date.now() };
  // A failed disk cache must not turn a successful network response into a feed outage.
  await AsyncStorage.setItem(FEED_KEY, JSON.stringify(feed)).catch(() => undefined);
  return feed;
}
export type Weather = { temperature: number; wind: number; humidity: number; label: string; time: string };
export async function fetchWeather(place: Place): Promise<Weather> {
  const raw = await request(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Australia%2FSydney`);
  const current = raw.current;
  if (!current || !Number.isFinite(current.temperature_2m)) throw new Error('Weather observations are unavailable.');
  const code = current.weather_code;
  return {
    temperature: current.temperature_2m, wind: current.wind_speed_10m, humidity: current.relative_humidity_2m,
    label: code === 0 ? 'Clear' : code <= 3 ? 'Cloudy' : code <= 48 ? 'Fog' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : 'Storms',
    time: current.time,
  };
}
export async function searchPlaces(query: string): Promise<Place[]> {
  const raw = await request(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=au&limit=5&q=${encodeURIComponent(query)}`);
  if (!Array.isArray(raw)) throw new Error('Location search is unavailable.');
  return raw.map((p: { display_name: string; lat: string; lon: string }) => ({
    name: p.display_name.split(',').slice(0, 2).join(','),
    detail: p.display_name, latitude: Number(p.lat), longitude: Number(p.lon),
  })).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}
export async function estimateRoute(start: Place, destination: Place): Promise<RouteEstimate> {
  const raw = await request(`https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false`);
  const route = raw.routes?.[0];
  if (raw.code !== 'Ok' || !route?.geometry?.coordinates?.length) throw new Error('No driving route could be found. You can still hand off to your navigation app.');
  return { start, destination, coordinates: route.geometry.coordinates, distance: route.distance / 1000, duration: route.duration / 60, calculatedAt: Date.now() };
}
