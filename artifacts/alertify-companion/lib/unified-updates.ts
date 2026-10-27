import type { CompanionFeeds, CompanionWeather, FireDistrictMatch } from '@workspace/api-client-react';
import { distance, type Incident, type WatchAddress } from './model';
import { eventInScope } from './weather-geometry';

export type UpdateSource = 'rfs' | 'tfnsw' | 'bom' | 'ses' | 'fireDanger' | 'weather';
export type UpdateSort = 'distance' | 'latest' | 'distanceLatest';
export type UpdateEntry = {
  id: string; originalId: string; source: UpdateSource; sourceName: string;
  title: string; category: string; description: string; location: string;
  latitude: number | null; longitude: number | null; updatedAt: number | null;
  watchIds?: string[]; generatedAt?: number | null;
};
export const updateSources = [
  ['all', 'All feeds'], ['rfs', 'NSW RFS'], ['tfnsw', 'TfNSW'], ['bom', 'BOM'],
  ['ses', 'SES'], ['fireDanger', 'Fire danger'], ['weather', 'Xweather'],
] as const;

/** RFS uses Sydney-local day-first dates, not the phone's timezone or US dates. */
export function updateTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const local = value.match(/^(\d{1,2})[ /-](\d{1,2}|[A-Za-z]{3})[ /-](\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (local) {
    const month = /^\d+$/.test(local[2]) ? Number(local[2]) - 1 : ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(local[2].toLowerCase());
    let hour = Number(local[4]);
    if (local[7]) hour = hour % 12 + (local[7].toUpperCase() === 'PM' ? 12 : 0);
    if (month < 0 || month > 11 || Number(local[1]) > 31 || hour > 23 || Number(local[5]) > 59) return null;
    const utc = Date.UTC(Number(local[3]), month, Number(local[1]), hour, Number(local[5]), Number(local[6] || 0));
    const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utc));
    const part = (key: string) => Number(parts.find(p => p.type === key)?.value);
    const offset = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - utc;
    return utc - offset;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function combineUpdates(
  incidents: Incident[], feeds: CompanionFeeds | undefined,
  watches: WatchAddress[], weather: CompanionWeather[] = [],
  districts: { watchId: string; match: FireDistrictMatch }[] = [], now = Date.now(),
): UpdateEntry[] {
  const entries: UpdateEntry[] = incidents.map(i => ({
    id: `rfs:${i.id}`, originalId: i.id, source: 'rfs', sourceName: 'NSW RFS',
    title: i.title, category: i.category, description: i.description, location: i.location || i.council,
    latitude: i.latitude, longitude: i.longitude, updatedAt: updateTimestamp(i.updated),
  }));
  for (const source of feeds?.sources ?? []) for (const r of source.reports) entries.push({
    ...r, id: `${source.id}:${r.id}`, originalId: r.id, source: source.id, sourceName: source.name,
    updatedAt: updateTimestamp(r.updatedAt),
  });
  for (const district of feeds?.fireRatings.districts ?? []) entries.push({
    id: `fireDanger:${district.name}`, originalId: district.name, source: 'fireDanger', sourceName: 'Fire danger',
    title: `${district.name} · ${district.today}`, category: district.totalFireBan ? 'Total fire ban today' : 'District fire danger rating',
    description: `Today: ${district.today}. Tomorrow: ${district.tomorrow}. Total fire ban: ${district.totalFireBan === null ? 'not supplied' : district.totalFireBan ? 'yes' : 'no'}.`,
    location: district.name, latitude: null, longitude: null,
    // Dataset refresh time is not evidence that a district's rating changed.
    updatedAt: null, generatedAt: updateTimestamp(feeds?.fireRatings.updatedAt),
    watchIds: districts.filter(d => d.match.status === 'matched' && d.match.district === district.name).map(d => d.watchId),
  });
  for (const result of weather) {
    for (const event of result.events) {
      if (event.validTo && Date.parse(event.validTo) < now) continue;
      if (event.kind === 'lightning' && now - Date.parse(event.validFrom) > 3600000) continue;
      const zones = watches.filter(w => eventInScope(event, w.place, null, w.radius));
      if (!zones.length) continue;
      entries.push({
        id: `weather:${event.kind}:${event.id}`, originalId: event.id, source: 'weather', sourceName: `Xweather ${event.kind}`,
        title: event.kind === 'lightning' ? 'Lightning detected' : 'Hail threat area',
        category: event.kind === 'lightning' ? 'Lightning strike' : 'Forecast hail threat',
        description: event.description, location: `Matched to ${zones.map(w => w.label).join(', ')}`,
        latitude: event.latitude, longitude: event.longitude, updatedAt: updateTimestamp(event.validFrom),
        watchIds: zones.map(w => w.id),
      });
    }
    for (const sample of result.samples) {
      const zones = watches.filter(w => distance(w.place, sample) < 0.1);
      if (!zones.length) continue;
      const label = zones.map(w => w.label).join(', ');
      if (sample.windGustKph !== null || sample.windSpeedKph !== null) entries.push({
        id: `weather:wind:${sample.latitude}:${sample.longitude}`, originalId: zones[0].id, source: 'weather', sourceName: 'Xweather wind',
        title: `Wind at ${label}`, category: `Gusts ${sample.windGustKph === null ? 'not supplied' : `${sample.windGustKph.toFixed(1)} km/h`}`,
        description: `Wind speed ${sample.windSpeedKph === null ? 'not supplied' : `${sample.windSpeedKph.toFixed(1)} km/h`} ${sample.windDirection}. Point sample, not an official warning.`,
        location: `Weather sample at ${label}`, latitude: sample.latitude, longitude: sample.longitude,
        updatedAt: updateTimestamp(sample.windTime), watchIds: zones.map(w => w.id),
      });
      if (sample.rainPeakMmH !== null || sample.rain60minMm !== null) entries.push({
        id: `weather:rain:${sample.latitude}:${sample.longitude}`, originalId: zones[0].id, source: 'weather', sourceName: 'Xweather rain',
        title: `Rain forecast at ${label}`, category: `Peak ${sample.rainPeakMmH === null ? 'not supplied' : `${sample.rainPeakMmH.toFixed(1)} mm/hour`}`,
        description: `Next hour ${sample.rain60minMm === null ? 'not supplied' : `${sample.rain60minMm.toFixed(1)} mm`}. Point forecast, not an official warning.`,
        location: `Weather sample at ${label}`, latitude: sample.latitude, longitude: sample.longitude,
        updatedAt: updateTimestamp(sample.rainTime), watchIds: zones.map(w => w.id),
      });
    }
  }
  return [...new Map(entries.map(entry => [entry.id, entry])).values()];
}

export function nearestWatch(entry: UpdateEntry, watches: WatchAddress[]) {
  if (entry.latitude === null || entry.longitude === null || !Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) return null;
  const point = { latitude: entry.latitude, longitude: entry.longitude };
  return watches.map(watch => ({ watch, km: distance(watch.place, point) })).sort((a, b) => a.km - b.km)[0] ?? null;
}
export function selectUpdates(entries: UpdateEntry[], watches: WatchAddress[], source: string, scope: 'home' | 'nsw', sort: UpdateSort, search: string) {
  const query = search.trim().toLowerCase();
  return entries.filter(entry => {
    if (source !== 'all' && entry.source !== source) return false;
    if (!`${entry.sourceName} ${entry.title} ${entry.category} ${entry.location} ${entry.description}`.toLowerCase().includes(query)) return false;
    if (scope === 'nsw') return true;
    if (entry.watchIds?.some(id => watches.some(w => w.id === id))) return true;
    if (entry.latitude === null || entry.longitude === null) return false;
    return watches.some(w => distance(w.place, { latitude: entry.latitude!, longitude: entry.longitude! }) <= w.radius);
  }).map(entry => ({ ...entry, nearest: nearestWatch(entry, watches) })).sort((a, b) => {
    const latest = (b.updatedAt ?? -Infinity) - (a.updatedAt ?? -Infinity);
    const km = (a.nearest?.km ?? Infinity) - (b.nearest?.km ?? Infinity);
    // Combined mode uses 5 km distance bands, then the newest source update.
    const band = Math.floor((a.nearest?.km ?? Infinity) / 5) - Math.floor((b.nearest?.km ?? Infinity) / 5);
    return (sort === 'latest' ? latest || km : sort === 'distanceLatest' ? band || latest || km : km || latest) || a.id.localeCompare(b.id);
  });
}
