import { getCompanionFireDistrict } from '@workspace/api-client-react';
import type { Place } from './model';

export type CoverageArea = 'nsw' | 'outside' | 'unknown';
export const nswWarningSources = 'NSW RFS incidents, TfNSW Live Hazards, BOM NSW Warnings, NSW SES HazardWatch and fire-danger mapping';
type DistrictResult = Awaited<ReturnType<typeof getCompanionFireDistrict>> | null;
export type CoveragePoint = {
  latitude: number; longitude: number; area: CoverageArea; district: DistrictResult;
};

/** Boundary failure is unknown, never outside NSW or a verified empty result. */
export function coverageArea(result: DistrictResult): CoverageArea {
  if (!result) return 'unknown';
  if (result.status === 'outside_nsw') return 'outside';
  if (result.status === 'matched') return 'nsw';
  // A known NSW council still establishes the jurisdiction when its rating
  // is stale, unmapped or ambiguous. It does not establish rating freshness.
  return result.lga ? 'nsw' : 'unknown';
}

export async function checkWarningCoverage(points: Pick<Place, 'latitude' | 'longitude'>[]): Promise<CoveragePoint[]> {
  return Promise.all(points.map(async point => {
    const district = await getCompanionFireDistrict(point).catch(() => null);
    return { ...point, area: coverageArea(district), district };
  }));
}

export function summarizeCoverage(points: Pick<CoveragePoint, 'area'>[]) {
  const nsw = points.filter(point => point.area === 'nsw').length;
  const outside = points.filter(point => point.area === 'outside').length;
  const unknown = points.length - nsw - outside;
  const status = !points.length || unknown ? 'unknown' : nsw && outside ? 'partial' : outside ? 'unsupported' : 'nsw';
  return { status, nsw, outside, unknown } as const;
}

export function coverageMessage(points: Pick<CoveragePoint, 'area'>[]) {
  const { status, nsw, outside, unknown } = summarizeCoverage(points);
  if (status === 'unknown') return `Warning coverage unconfirmed${points.length ? ` · ${nsw} NSW, ${outside} outside NSW, ${unknown} unconfirmed points` : ''}. Missing coverage is not an all-clear.`;
  if (status === 'unsupported') return 'Warning coverage unsupported at all checked points outside NSW. An empty NSW warning list does not assess this route.';
  if (status === 'partial') return `Partial warning coverage · ${nsw} checked points in NSW, ${outside} outside NSW. NSW feeds do not assess the interstate sections.`;
  return 'NSW warning coverage at all checked points. This does not verify coverage between points or across the full 5 km corridor.';
}
