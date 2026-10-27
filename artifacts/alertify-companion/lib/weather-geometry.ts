import { distance, routeDistance, type Place } from './model';
import type { WeatherEvent } from '@workspace/api-client-react';
type Point = Pick<Place, 'latitude' | 'longitude'>;
type XY = [number, number];

/** Equally spaced by distance, not by OSRM vertex count. Includes both ends. */
export function routeSamples(coordinates: XY[], count = 5): Point[] {
  if (!coordinates.length) return [];
  const point = (p: XY): Point => ({ latitude: p[1], longitude: p[0] });
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) cumulative.push(cumulative[i - 1] + distance(point(coordinates[i - 1]), point(coordinates[i])));
  const total = cumulative.at(-1)!;
  if (!total) return [point(coordinates[0])];
  const n = Math.min(Math.max(2, Math.ceil(total / 50) + 1), count);
  const samples = Array.from({ length: n }, (_, i) => {
    const target = total * i / (n - 1);
    let j = 1;
    while (j < cumulative.length - 1 && cumulative[j] < target) j++;
    const fraction = (target - cumulative[j - 1]) / (cumulative[j] - cumulative[j - 1] || 1);
    const a = coordinates[j - 1], b = coordinates[j];
    return { latitude: a[1] + (b[1] - a[1]) * fraction, longitude: a[0] + (b[0] - a[0]) * fraction };
  });
  return [...new Map(samples.map(p => [`${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`, p])).values()];
}
export function maxSampleGap(points: Point[]) {
  return points.length < 2 ? 0 : Math.max(...points.slice(1).map((p, i) => distance(points[i], p)));
}
function inRing(p: XY, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function inPolygon(p: XY, rings: number[][][]) {
  return !!rings.length && inRing(p, rings[0]) && !rings.slice(1).some(r => inRing(p, r));
}
const cross = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function intersects(a: XY, b: XY, c: XY, d: XY) {
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
  return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
}
function segmentDistance(p: XY, a: XY, b: XY) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function polygonNearPath(rings: number[][][], path: XY[], radius: number): boolean {
  if (!rings.length || !path.length) return false;
  if (path.some(p => inPolygon(p, rings))) return true;
  const scale = Math.cos(rings[0][0][1] * Math.PI / 180);
  const project = (p: number[]): XY => [p[0] * 111.195 * scale, p[1] * 111.195];
  const line = path.map(project);
  for (const ring of rings) for (let j = 0; j < ring.length - 1; j++) {
    const a = project(ring[j]), b = project(ring[j + 1]);
    if (line.length === 1 && segmentDistance(line[0], a, b) <= radius) return true;
    for (let i = 1; i < line.length; i++) {
      const c = line[i - 1], d = line[i];
      if (Math.max(a[0], b[0]) + radius < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) + radius < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) + radius < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) + radius < Math.min(a[1], b[1])) continue;
      if (intersects(a, b, c, d) || Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)) <= radius) return true;
    }
  }
  return false;
}
export function eventInScope(event: WeatherEvent, zone: Point | null, path: XY[] | null, radius: number) {
  if (event.kind === 'hail') return polygonNearPath(event.polygon, path || (zone ? [[zone.longitude, zone.latitude]] : []), radius);
  if (event.latitude === null || event.longitude === null) return false;
  const p = { latitude: event.latitude, longitude: event.longitude };
  return path ? (path.length === 1 ? distance(p, { latitude: path[0][1], longitude: path[0][0] }) : routeDistance(p, path)) <= radius : !!zone && distance(zone, p) <= radius;
}
