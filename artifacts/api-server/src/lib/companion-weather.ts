import type { CompanionWeather, WeatherSource, WeatherRadar } from '@workspace/api-zod';
import { type Json, type Point, iso, makeSample, stormEvents } from './weather-normalize';
import { assessFreshness, warningFreshnessLimits } from './warning-freshness';

const cache = new Map<string, { expires: number; promise: Promise<Json> }>();
let active = 0;
const waiting: (() => void)[] = [];
async function limitedFetch(url: string): Promise<Json> {
  if (active < 4) active++;
  else {
    if (waiting.length >= 20) throw new Error('Weather service is busy. Please retry shortly.');
    await new Promise<void>((resolve, reject) => {
      const start = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
        reject(new Error('Weather service is busy. Please retry shortly.'));
      }, 15000);
      waiting.push(start);
    });
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Alertify weather source returned HTTP ${res.status}.`);
    const raw = await res.json() as Json;
    if (raw.success === false || raw.error) throw new Error(String(raw.error || 'Source unavailable').replace(/<[^>]*>/g, '').slice(0, 200));
    return raw;
  } finally {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
}
function cached(url: string) {
  const entry = cache.get(url);
  if (entry && entry.expires > Date.now()) return entry.promise;
  const promise = limitedFetch(url);
  // Cache failures briefly too, rather than repeatedly hitting a failing upstream.
  cache.set(url, { expires: Date.now() + 90000, promise });
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return promise;
}
async function xweather(kind: string, point?: Point, points?: Point[]): Promise<Json> {
  const query = new URLSearchParams({ kind });
  if (point) { query.set('lat', String(point.latitude)); query.set('lon', String(point.longitude)); }
  if (points) query.set('points', points.map(p => `${p.latitude},${p.longitude}`).join(';'));
  const data = await cached(`https://alertify.au/xweather-proxy.php?${query}`);
  if (data.success !== true) throw new Error('Alertify could not confirm the Xweather request.');
  return data;
}
async function radar(): Promise<WeatherRadar> {
  try {
    const raw = await cached('https://api.rainviewer.com/public/weather-maps.json');
    if (raw.host !== 'https://tilecache.rainviewer.com') throw new Error('Unrecognised radar tile host.');
    const frames = (Array.isArray(raw.radar?.past) ? raw.radar.past : []).filter((f: Json) => typeof f.time === 'number' && /^\/v2\/radar\/[a-zA-Z0-9/_-]+$/.test(f.path)).slice(-13).map((f: Json) => ({ time: f.time, path: f.path }));
    if (!frames.length) throw new Error('RainViewer supplied no radar frames.');
    const stale = Date.now() - frames.at(-1)!.time * 1000 > 20 * 60000;
    return { status: stale ? 'stale' : 'live', error: stale ? 'Latest radar frame is more than 20 minutes old.' : null, generatedAt: iso(raw.generated), host: raw.host, frames };
  } catch (e) { return { status: 'unavailable', error: message(e), generatedAt: '', host: '', frames: [] }; }
}
const message = (e: unknown) => e instanceof Error ? e.message : 'Source unavailable.';
type Result = { data: Json | null; error: string | null };
async function attempt(job: Promise<Json>): Promise<Result> {
  try { return { data: await job, error: null }; } catch (e) { return { data: null, error: message(e) }; }
}
export async function getWeather(points: Point[]): Promise<CompanionWeather> {
  const [grid, lightning, hail, rain, radarData] = await Promise.all([
    attempt(xweather('weather-grid', undefined, points)),
    Promise.all(points.map(p => attempt(xweather('lightning', p)))),
    Promise.all(points.map(p => attempt(xweather('hail', p)))),
    Promise.all(points.map(p => attempt(xweather('rain-nowcast', p)))),
    radar(),
  ]);
  const events: CompanionWeather['events'] = [];
  const sources: WeatherSource[] = [];
  for (const [kind, results] of [['lightning', lightning], ['hail', hail]] as const) {
    for (const result of results) if (result.data) {
      try { events.push(...stormEvents(kind, result.data)); } catch (e) { result.error = message(e); result.data = null; }
    }
    sources.push(source(kind, kind === 'hail' ? 'Xweather Hail Threats' : 'Xweather Lightning', results));
  }
  const samples = points.map((p, i) => makeSample(p, grid.data, rain[i].data));
  const winds: Result[] = samples.map(s => ({ data: s.windSpeedKph !== null || s.windGustKph !== null ? { fetched_at: s.windTime } : null, error: grid.error || 'No wind observation returned for this sample.' }));
  const rains: Result[] = samples.map((s, i) => ({ data: s.rainPeakMmH !== null ? { fetched_at: rain[i].data?.fetched_at } : null, error: rain[i].error || 'No rain nowcast returned for this sample.' }));
  sources.push(source('wind', 'Xweather Wind', winds, warningFreshnessLimits.wind), source('rain', 'Xweather Rain', rains, warningFreshnessLimits.rain));
  return { fetchedAt: new Date().toISOString(), sources, samples, events: [...new Map(events.map(e => [e.id, e])).values()], radar: radarData };
}
function source(id: WeatherSource['id'], name: string, results: Result[], maxAgeMinutes = 15): WeatherSource {
  const good = results.filter(r => r.data);
  const fetchedAt = good.map(r => iso(r.data?.fetched_at)).sort()[0] || '';
  const freshness = good.length ? assessFreshness(fetchedAt, maxAgeMinutes) : assessFreshness(null, maxAgeMinutes);
  const stale = freshness.status !== 'current';
  return { id, name, status: !good.length || freshness.status === 'unavailable' ? 'unavailable' : stale ? 'stale' : good.length < results.length ? 'partial' : 'live',
    error: good.length < results.length ? [...new Set(results.filter(r => !r.data).map(r => r.error))].join(' ') : stale ? 'Source timestamps are missing or outside the freshness window.' : null,
    availablePoints: good.length, requestedPoints: results.length, fetchedAt, freshness };
}
