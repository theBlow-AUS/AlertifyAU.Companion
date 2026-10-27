import { createHash } from 'node:crypto';
import type { WeatherEvent, WeatherSample } from '@workspace/api-zod';

export type Json = Record<string, any>;
export type Point = { latitude: number; longitude: number };
export const numeric = (v: unknown): number | null => (typeof v !== 'number' && typeof v !== 'string') || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
export function iso(v: unknown): string {
  if (!v) return '';
  const d = new Date(typeof v === 'number' ? v * (v < 1e12 ? 1000 : 1) : String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}
const idFor = (kind: string, value: unknown) => `${kind}:${createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 20)}`;
export function parsePoints(value: unknown): Point[] {
  if (typeof value !== 'string' || value.length > 240) throw new Error('Provide one to five lat,lon pairs separated by semicolons.');
  const parts = value.split(';');
  if (!parts.length || parts.length > 5) throw new Error('Weather checks support at most five sample points.');
  const points = parts.map(part => {
    const fields = part.split(',');
    if (fields.length !== 2 || fields.some(f => f.trim() === '')) throw new Error('Invalid coordinate pair.');
    const [lat, lon] = fields.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Coordinates are outside valid latitude/longitude ranges.');
    return { latitude: Number(lat.toFixed(4)), longitude: Number(lon.toFixed(4)) };
  });
  return [...new Map(points.map(p => [`${p.latitude},${p.longitude}`, p])).values()];
}
export function stormEvents(kind: 'lightning' | 'hail', raw: Json): WeatherEvent[] {
  if (!Array.isArray(raw.response)) throw new Error('Unexpected storm feed format.');
  const events: WeatherEvent[] = [];
  for (const row of raw.response) {
    if (kind === 'lightning') {
      const latitude = numeric(row.loc?.lat), longitude = numeric(row.loc?.long);
      if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Lightning records lack valid positions; local coverage cannot be confirmed.');
      const time = iso(row.ob?.dateTimeISO || row.ob?.timestamp);
      if (!time) throw new Error('Lightning record timestamps are unavailable.');
      if (Date.parse(time) - Date.now() > 5 * 60000) throw new Error('Lightning record timestamps are unexpectedly in the future.');
      if (time && Date.now() - Date.parse(time) > 60 * 60000) continue;
      const type = String(row.ob?.pulse?.type || 'Unspecified');
      events.push({ id: idFor(kind, [latitude, longitude, time, type]), kind, latitude, longitude, polygon: [], validFrom: time, validTo: '', description: `${type === 'CG' ? 'Cloud-to-ground' : type === 'IC' ? 'Intracloud' : type} lightning strike` });
    } else {
      if (!Array.isArray(row.periods)) throw new Error('Hail forecast periods are unavailable.');
      for (const period of row.periods) {
        const geometry = period.polygon;
        if (geometry?.type !== 'Polygon' || !validPolygon(geometry.coordinates)) throw new Error('Hail forecast geometry is unavailable; affected areas cannot be matched.');
        const from = iso(period.range?.minDateTimeISO || period.range?.minTimestamp);
        if (!from) throw new Error('Hail forecast validity times are unavailable.');
        const to = iso(period.range?.maxDateTimeISO || period.range?.maxTimestamp);
        if (to && Date.parse(to) < Date.now()) continue;
        const hail = row.details?.hail || {}, size = numeric(hail.maxSizeMM), probability = numeric(hail.probSevere);
        events.push({ id: idFor(kind, [geometry.coordinates, from, to]), kind, latitude: null, longitude: null, polygon: geometry.coordinates, validFrom: from, validTo: to,
          description: `${hail.severe === true ? 'Severe hail threat' : 'Hail threat'} · maximum ${size === null ? 'size not supplied' : `${size.toFixed(1)} mm`}${probability === null ? '' : ` · severe probability ${Math.round(probability)}%`}` });
      }
    }
  }
  return events;
}
function validPolygon(value: unknown): value is number[][][] {
  return Array.isArray(value) && value.length > 0 && value.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(p => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90) && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]);
}
const nonnegative = (v: unknown) => { const n = numeric(v); return n !== null && n >= 0 ? n : null; };
export function makeSample(point: Point, grid: Json | null, rain: Json | null): WeatherSample {
  const feature = Array.isArray(grid?.response) ? grid.response.find((f: Json) => Math.abs(Number(f.geometry?.coordinates?.[1]) - point.latitude) < 0.00015 && Math.abs(Number(f.geometry?.coordinates?.[0]) - point.longitude) < 0.00015) : null;
  const wind = feature?.properties?.request?.success === false ? null : feature?.properties?.response?.periods?.[0];
  const periods = (Array.isArray(rain?.response) ? rain.response[0]?.periods : rain?.response?.periods);
  const future: Json[] = Array.isArray(periods) ? periods.filter((p: Json) => Date.parse(iso(p.dateTimeISO || p.timestamp)) >= Date.now() - 120000).slice(0, 60) : [];
  const amounts = future.map(p => nonnegative(p.precipMM)), rates = future.map(p => nonnegative(p.precipRateMM)).filter((n): n is number => n !== null);
  const rainTime = iso(future[0]?.dateTimeISO || future[0]?.timestamp), rainEnd = iso(future.at(-1)?.dateTimeISO || future.at(-1)?.timestamp);
  const minuteSpacing = future.length === 60 && future.every((p, i) => i === 0 || Math.abs(Date.parse(iso(p.dateTimeISO || p.timestamp)) - Date.parse(iso(future[i - 1].dateTimeISO || future[i - 1].timestamp)) - 60000) < 1000);
  return { ...point, windTime: iso(wind?.dateTimeISO), windSpeedKph: nonnegative(wind?.windSpeedKPH), windGustKph: nonnegative(wind?.windGustKPH), windDirection: String(wind?.windDir || ''),
    currentRainMmH: nonnegative(wind?.precipRateMM), rainTime, rainEnd,
    rain60minMm: minuteSpacing && amounts.every(n => n !== null) ? (amounts as number[]).reduce((a, b) => a + b, 0) : null,
    rainPeakMmH: rates.length ? Math.max(...rates) : null };
}
