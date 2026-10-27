import type { FireDistrict, FireDistrictMatch } from '@workspace/api-zod';
type Json = Record<string, any>;
export type Feature = { geometry: Json; properties: Json };

export const normalizeLga = (name: unknown) => String(name ?? '').trim().toUpperCase().replace(/&/g, 'AND')
  .replace(/\b(FIRE\s+WEATHER\s+AREA|FIRE\s+DISTRICT|DISTRICT)\b/g, '').replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const lgaName = (p: Json) => p.lganame ?? p.LGANAME ?? p.LGAName ?? p.NSW_LGA__2 ?? p.NSW_LGA__3 ?? p.LGA_NAME ?? p.LGA_NAME21 ?? p.LGA_NAME24 ?? p.lga_name ?? p.name;
const fallbacks: Record<string, string> = {
  'NORTHERN BEACHES': 'Greater Sydney Region', 'THE HILLS SHIRE': 'Greater Sydney Region', 'THE HILLS': 'Greater Sydney Region',
  'SUTHERLAND SHIRE': 'Greater Sydney Region', 'SUTHERLAND': 'Greater Sydney Region', 'CENTRAL COAST': 'Greater Sydney Region',
  'SNOWY MONARO REGIONAL': 'Monaro Alpine', 'SNOWY MONARO': 'Monaro Alpine',
  'QUEANBEYAN PALERANG REGIONAL': 'Southern Ranges', 'QUEANBEYAN PALERANG': 'Southern Ranges',
  'MID WESTERN REGIONAL': 'Central Ranges', 'MID WESTERN': 'Central Ranges',
  'COOTAMUNDRA GUNDAGAI REGIONAL': 'Southern Slopes', 'COOTAMUNDRA GUNDAGAI': 'Southern Slopes',
};

function onSegment(p: number[], a: number[], b: number[]) {
  const cross = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1]);
  return Math.abs(cross) < 1e-9 && p[0] >= Math.min(a[0], b[0]) - 1e-9 && p[0] <= Math.max(a[0], b[0]) + 1e-9
    && p[1] >= Math.min(a[1], b[1]) - 1e-9 && p[1] <= Math.max(a[1], b[1]) + 1e-9;
}
function insideRing(point: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function pointInBoundary(point: [number, number], geometry: Json) {
  const polygons: number[][][][] = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(rings => Array.isArray(rings) && rings.length > 0 && Array.isArray(rings[0]) && insideRing(point, rings[0]) && !rings.slice(1).some((ring: number[][]) => insideRing(point, ring)));
}
function withinMetersOfBoundary(point: [number, number], geometry: Json, meters: number) {
  const polygons: number[][][][] = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const scaleLon = Math.cos(point[1] * Math.PI / 180) * 111320, scaleLat = 110574;
  for (const rings of polygons) for (const ring of rings) for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const a = [(ax - point[0]) * scaleLon, (ay - point[1]) * scaleLat], b = [(bx - point[0]) * scaleLon, (by - point[1]) * scaleLat];
    const dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / (d2 || 1)));
    if (Math.hypot(a[0] + t * dx, a[1] + t * dy) <= meters) return true;
  }
  return false;
}
function validFeature(f: Json) {
  const polygons: any[] = f?.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f?.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  const validRing = (ring: any) => Array.isArray(ring) && ring.length >= 4
    && ring.every((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
    && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1];
  return !!normalizeLga(lgaName(f?.properties || {})) && polygons.length > 0 && polygons.every(poly =>
    Array.isArray(poly) && poly.length > 0 && poly.every(validRing));
}
export function hasValidFireBoundary(f: Json): f is Feature {
  return validFeature(f);
}
export function matchFireDistrict(point: [number, number], features: Feature[], ratings: FireDistrict[]): Omit<FireDistrictMatch, 'fetchedAt'> {
  const inside = features.filter(f => pointInBoundary(point, f.geometry));
  // Coordinate rounding in source polygons can place a pin on a shared border.
  // Consider nearby LGAs only when the pin is also inside at least one valid NSW polygon.
  const candidates = inside.length ? features.filter(f => inside.includes(f) || withinMetersOfBoundary(point, f.geometry, 20)) : [];
  if (!candidates.length) {
    return features.some(f => !validFeature(f))
      ? { status: 'unavailable', lga: null, district: null, error: 'Alertify boundary data is incomplete; the pin cannot be matched safely.' }
      : { status: 'outside_nsw', lga: null, district: null, error: null };
  }
  const byCouncil = new Map<string, string>();
  for (const d of ratings) for (const council of d.councils) byCouncil.set(normalizeLga(council), d.name);
  const matches = candidates.map(f => {
    const name = normalizeLga(lgaName(f.properties));
    return { name, district: byCouncil.get(name) || fallbacks[name] || null };
  });
  const lgas = [...new Set(matches.map(x => x.name))].sort();
  const districts = [...new Set(matches.map(x => x.district))];
  const lga = lgas.join(' / ');
  if (districts.length !== 1 || !districts[0]) {
    return { status: districts.length > 1 ? 'ambiguous' : 'unavailable', lga, district: null,
      error: districts.length > 1 ? 'The pin is on or very near an LGA boundary; adjacent LGAs map to different fire districts. A rating was not guessed.' : `Alertify does not map ${lga} to a fire-weather district.` };
  }
  const district = ratings.find(d => normalizeLga(d.name) === normalizeLga(districts[0]));
  if (!district) return { status: 'unavailable', lga, district: null, error: `Alertify mapped ${lga} to ${districts[0]}, but that district’s rating was not returned.` };
  return { status: 'matched', lga, district: district.name, error: null };
}
