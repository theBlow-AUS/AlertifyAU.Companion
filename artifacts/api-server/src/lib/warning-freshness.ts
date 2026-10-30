export type FreshnessStatus = 'current' | 'stale' | 'unavailable';

export type WarningFreshness = {
  status: FreshnessStatus;
  maxAgeMinutes: number;
  ageMinutes: number | null;
};

export const warningFreshnessLimits = {
  rfsIncidentFeed: 5,
  tfnsw: 30,
  bom: 12 * 60,
  ses: 2 * 60,
  fireDanger: 24 * 60,
  lightning: 15,
  hail: 15,
  wind: 30,
  rain: 15,
} as const;

export function assessFreshness(
  timestamp: string | null | undefined,
  maxAgeMinutes: number,
  now = Date.now(),
): WarningFreshness {
  if (!timestamp || !Number.isFinite(maxAgeMinutes) || maxAgeMinutes < 0) {
    return { status: 'unavailable', maxAgeMinutes, ageMinutes: null };
  }
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return { status: 'unavailable', maxAgeMinutes, ageMinutes: null };
  const age = now - time;
  if (age < -5 * 60000) return { status: 'unavailable', maxAgeMinutes, ageMinutes: null };
  const ageMinutes = Math.max(0, Math.floor(age / 60000));
  return {
    status: age <= maxAgeMinutes * 60000 ? 'current' : 'stale',
    maxAgeMinutes,
    ageMinutes,
  };
}
