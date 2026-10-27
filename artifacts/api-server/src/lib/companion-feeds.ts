import type { CompanionFeeds, HazardReport, HazardSource, FireRatings } from '@workspace/api-zod';

type Json = Record<string, any>;
const endpoint = 'https://alertify.au/';
const definitions = [
  { id: 'tfnsw', name: 'TfNSW Live Hazards', path: 'tfnsw-hazards-proxy.php' },
  { id: 'bom', name: 'BOM NSW Warnings', path: 'bom-warnings.php' },
  { id: 'ses', name: 'NSW SES HazardWatch', path: 'ses-hazard-watch.php' },
] as const;
const clean = (value: unknown) => String(value ?? '').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
function timestamp(value: unknown): string {
  if (!value) return '';
  const date = new Date(typeof value === 'number' ? value : String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}
function safeUrl(value: unknown, fallback: string) {
  try { const url = new URL(String(value)); if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString(); } catch { /* Use the official source below. */ }
  return fallback;
}
async function download(path: string): Promise<Json> {
  const response = await fetch(endpoint + path, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Alertify upstream returned HTTP ${response.status}.`);
  const json = await response.json() as Json;
  if (json.success === false || json.error) throw new Error(clean(json.error || 'Alertify reports the source is unavailable.'));
  return json;
}
function normalizeReports(id: string, raw: Json): HazardReport[] {
  if (!Array.isArray(raw.features)) throw new Error('Alertify returned an unexpected feed format.');
  if (id === 'bom' && Array.isArray(raw.warnings)) {
    return raw.warnings.map((p: Json, i: number) => ({
      id: `bom:${p.guid || p.link || i}`, title: clean(p.title), category: 'Weather warning',
      description: clean(p.description) || 'Alertify supplied the warning headline, but not its full bulletin text. Check the named warning area before acting.',
      location: 'NSW warning feed · location not geocoded', updatedAt: timestamp(p.pub_date),
      sourceUrl: safeUrl(p.link, 'https://www.bom.gov.au/nsw/warnings.shtml'),
      latitude: null, longitude: null, severity: /emergency/i.test(p.title) ? 3 : 2,
    }));
  }
  return raw.features.filter((f: Json) => !f.properties?.ended).map((f: Json, i: number) => {
    const p = f.properties || {}, point = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
    const roads = Array.isArray(p.roads) ? p.roads.map((r: Json) => [r.mainStreet, r.suburb, r.secondLocation].filter(Boolean).join(', ')).join('; ') : '';
    const category = clean(id === 'tfnsw' ? p.mainCategory || p._alertifyHazardType : p.warninglevel || p.warningLevel || p.severity || 'Information');
    const location = roads || clean(p.location || p.areaDesc || p.areadesc || p.warningarea || p.area);
    const description = id === 'tfnsw'
      ? [p.adviceA, p.adviceB, p.adviceC, p.otherAdvice, p.diversions].map(clean).filter(Boolean).join('\n')
      : clean(p.description || p.descriptiontext || p.message || p.instruction || p.headline);
    return {
      id: `${id}:${f.id || p.identifier || p.id || i}`,
      title: clean(p.headline || p.event || p.eventcodename || p.displayName || p.name || category) + (roads ? ` · ${roads}` : ''),
      category, location: location || 'Area not supplied / not geocoded', description: description || 'No additional details supplied.',
      updatedAt: timestamp(p.lastUpdated || p.sent || p.issued || p.updated || p.issue_date),
      sourceUrl: safeUrl(p.web || p.url || p.link, id === 'tfnsw' ? 'https://www.livetraffic.com/' : 'https://www.ses.nsw.gov.au/'),
      latitude: point && Number.isFinite(point[1]) ? point[1] : null,
      longitude: point && Number.isFinite(point[0]) ? point[0] : null,
      severity: /emergency|evacuat/i.test(category) ? 3 : /watch|act/i.test(category) || p.isMajor ? 2 : /advice/i.test(category) ? 1 : 0,
    };
  });
}
let lastFire: FireRatings | null = null;
const lastSources = new Map<string, HazardSource>();
async function fireRatings(): Promise<FireRatings> {
  try {
    const raw = await download('fire-weather-data.php');
    if (!Array.isArray(raw.districts) || !raw.districts.length) throw new Error('Fire weather districts are missing from Alertify.');
    const updatedAt = timestamp(raw.generated_utc) || null;
    const stale = !!updatedAt && Date.now() - Date.parse(updatedAt) > 60 * 60000;
    lastFire = {
      status: stale ? 'stale' : 'live', error: stale ? 'Alertify fire rating data is over one hour old.' : null,
      fetchedAt: new Date().toISOString(), updatedAt,
      districts: raw.districts.map((d: Json) => ({
        name: clean(d.name), today: clean(d.today) || 'Not supplied', tomorrow: clean(d.tomorrow) || 'Not supplied',
        totalFireBan: typeof d.total_fire_ban === 'boolean' ? d.total_fire_ban : null,
        checkedAt: clean(d.last_checked), councils: Array.isArray(d.councils) ? d.councils.map(clean) : [],
      })),
    };
    return lastFire;
  } catch (e) {
    return { status: lastFire ? 'stale' : 'unavailable', error: e instanceof Error ? e.message : 'Fire ratings unavailable.', fetchedAt: lastFire?.fetchedAt ?? null, updatedAt: lastFire?.updatedAt ?? null, districts: lastFire?.districts ?? [] };
  }
}
async function source(def: typeof definitions[number]): Promise<HazardSource> {
  try {
    const raw = await download(def.path);
    const reports = normalizeReports(def.id, raw);
    const partial = Object.values(raw.feedStatus || {}).some((s: any) => s.ok === false);
    const updatedAt = timestamp(raw._alertify_generated_utc || raw.lastPublished) || null;
    const stale = raw._alertify_stale === true || (!!updatedAt && Date.now() - Date.parse(updatedAt) > 30 * 60000);
    const result: HazardSource = {
      id: def.id, name: def.name, status: stale ? 'stale' : partial ? 'partial' : 'live',
      error: stale ? 'Alertify reports stale data or the feed is over 30 minutes old.' : partial ? 'Some TfNSW source layers could not be refreshed.' : null,
      fetchedAt: new Date().toISOString(), updatedAt, reports,
    };
    lastSources.set(def.id, result);
    return result;
  } catch (e) {
    const old = lastSources.get(def.id);
    return {
      id: def.id, name: def.name, status: old ? 'stale' : 'unavailable',
      error: e instanceof Error ? e.message : 'Source unavailable.',
      fetchedAt: old?.fetchedAt ?? null, updatedAt: old?.updatedAt ?? null, reports: old?.reports ?? [],
    };
  }
}
let cached: { at: number; data: CompanionFeeds } | null = null;
let pending: Promise<CompanionFeeds> | null = null;
export function getFeeds(): Promise<CompanionFeeds> {
  if (cached && Date.now() - cached.at < 60000) return Promise.resolve(cached.data);
  if (pending) return pending;
  pending = Promise.all([fireRatings(), Promise.all(definitions.map(source))])
    .then(([fireRatings, sources]) => {
      const data = { fireRatings, sources };
      cached = { at: Date.now(), data };
      return data;
    }).finally(() => { pending = null; });
  return pending;
}
