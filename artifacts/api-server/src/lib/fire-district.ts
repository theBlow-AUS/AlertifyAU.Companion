import type { FireDistrictMatch } from '@workspace/api-zod';
import { getFeeds } from './companion-feeds';
import { hasValidFireBoundary, matchFireDistrict, type Feature } from './fire-district-match';
import type { Json } from './weather-normalize';

type BoundaryData = { features: Feature[]; fetchedAt: string; expiresAt: number };
let boundaryData: BoundaryData | null = null;
let boundaryRequest: Promise<BoundaryData> | null = null;
let retryAfter = 0;

async function boundaries(): Promise<{ data: BoundaryData; staleError: string | null }> {
  if (boundaryData && boundaryData.expiresAt > Date.now()) return { data: boundaryData, staleError: null };
  if (boundaryRequest) {
    try { return { data: await boundaryRequest, staleError: null }; }
    catch (e) {
      if (boundaryData && Date.now() - Date.parse(boundaryData.fetchedAt) < 30 * 86400000) {
        return { data: boundaryData, staleError: e instanceof Error ? `Boundary refresh failed: ${e.message}` : 'Using cached NSW boundaries.' };
      }
      throw e;
    }
  }
  if (Date.now() < retryAfter) {
    if (boundaryData && Date.now() - Date.parse(boundaryData.fetchedAt) < 30 * 86400000) return { data: boundaryData, staleError: 'Alertify boundary refresh failed; using cached council boundaries.' };
    throw new Error('Alertify NSW council boundaries are unavailable.');
  }
  boundaryRequest = (async () => {
    const response = await fetch('https://alertify.au/nsw-lga-boundaries.php', { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/geo+json, application/json' } });
    if (!response.ok) throw new Error(`Alertify NSW council boundaries returned HTTP ${response.status}.`);
    const raw = await response.json() as Json;
    if (!Array.isArray(raw.features) || raw.features.length < 100) throw new Error('Alertify returned incomplete NSW council boundaries.');
    const valid = raw.features.filter(hasValidFireBoundary);
    if (valid.length < raw.features.length * 0.95) throw new Error('Alertify returned incomplete or unsupported council boundary geometry.');
    return boundaryData = { features: valid, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + 24 * 60 * 60000 };
  })().finally(() => { boundaryRequest = null; });
  try { return { data: await boundaryRequest, staleError: null }; }
  catch (e) {
    retryAfter = Date.now() + 15 * 60000;
    if (boundaryData && Date.now() - Date.parse(boundaryData.fetchedAt) < 30 * 86400000) return { data: boundaryData, staleError: e instanceof Error ? `Boundary refresh failed: ${e.message}` : 'Using cached NSW boundaries.' };
    throw e;
  }
}

export async function fireDistrictAt(latitude: number, longitude: number): Promise<FireDistrictMatch> {
  try {
    const [boundary, feeds] = await Promise.all([boundaries(), getFeeds()]);
    const match = matchFireDistrict([longitude, latitude], boundary.data.features, feeds.fireRatings.districts);
    if (match.status === 'outside_nsw' && boundary.staleError) {
      return { status: 'unavailable', lga: null, district: null, error: boundary.staleError, fetchedAt: boundary.data.fetchedAt };
    }
    if (match.status === 'unavailable' && match.lga && !feeds.fireRatings.districts.length) {
      return { ...match, error: feeds.fireRatings.error || 'Alertify fire-weather ratings are unavailable; the pin’s current district cannot be confirmed.', fetchedAt: new Date().toISOString() };
    }
    const staleError = boundary.staleError || (feeds.fireRatings.status === 'stale' ? feeds.fireRatings.error : null);
    return { ...match, status: staleError && match.status === 'matched' ? 'stale' : match.status,
      error: staleError || match.error, fetchedAt: boundary.data.fetchedAt };
  } catch (e) {
    return { status: 'unavailable', lga: null, district: null, error: e instanceof Error ? e.message : 'Location district could not be verified.', fetchedAt: '' };
  }
}
