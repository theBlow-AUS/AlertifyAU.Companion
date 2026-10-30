import { getCompanionFeeds, getCompanionWeather } from '@workspace/api-client-react';
import { alertHazardOptions, distance, isCurrentTrip, routeDistance, type AlertHazardKey, type Place, type Settings, type Trip } from './model';
import { eventInScope, routeSamples } from './weather-geometry';
import type { HazardNotice, HazardScopeSnapshot } from './monitor-state';
import { checkWarningCoverage, coverageMessage, nswWarningSources, summarizeCoverage } from './warning-coverage';

type Point = Pick<Place, 'latitude' | 'longitude'>;
type Scope = {
  id: string; label: string; signature: string; place: Point | null;
  path: [number, number][] | null; radius: number; level: Settings['homeLevel'];
  points: Point[];
};
type WeatherHazardKey = 'lightning' | 'hail' | 'wind' | 'rain';
type WeatherHazardOption = (typeof alertHazardOptions)[number] & { key: WeatherHazardKey };
const weatherHazards = new Set<WeatherHazardKey>(['lightning', 'hail', 'wind', 'rain']);
const isWeatherHazard = (key: AlertHazardKey): key is WeatherHazardKey => weatherHazards.has(key as WeatherHazardKey);
const reportSources = ['tfnsw', 'bom', 'ses'] as const;

function scopesFor(settings: Settings, trip: Trip | null, currentLocation?: Pick<Place, 'latitude' | 'longitude'> | null): Scope[] {
  const scopes: Scope[] = [];
  if (settings.watch) for (const watch of settings.watches.filter(w => w.enabled)) scopes.push({
    id: `watch:${watch.id}`, label: watch.label,
    signature: JSON.stringify([watch.place.latitude, watch.place.longitude, watch.radius, settings.homeLevel]),
    place: watch.place, path: null, radius: watch.radius, level: settings.homeLevel,
    points: [{ latitude: watch.place.latitude, longitude: watch.place.longitude }],
  });
  if (isCurrentTrip(trip) && trip.coordinates.length) {
    const points = routeSamples(trip.coordinates);
    scopes.push({
      id: `trip:${trip.startedAt}`, label: `Trip · ${trip.start.name} to ${trip.destination.name}`,
      signature: JSON.stringify([trip.coordinates, settings.tripLevel]),
      place: null, path: trip.coordinates, radius: 5, level: settings.tripLevel, points,
    });
  }
  if (settings.currentLocationAlerts && currentLocation) {
    const level = isCurrentTrip(trip) ? settings.tripLevel : settings.homeLevel;
    scopes.push({
      id: 'current-location',
      label: `Current location · ${settings.currentLocationRadiusKm} km`,
      signature: JSON.stringify([settings.currentLocationRadiusKm, level]),
      place: currentLocation, path: null, radius: settings.currentLocationRadiusKm, level,
      points: [currentLocation],
    });
  }
  return scopes;
}
const minimumSeverity = (level: Settings['homeLevel']) => level === 'urgent' ? 3 : level === 'significant' ? 2 : 0;
function reportMatches(scope: Scope, report: { latitude: number | null; longitude: number | null }, source: string) {
  if (report.latitude === null || report.longitude === null) return source === 'bom';
  const point = { latitude: report.latitude, longitude: report.longitude };
  return scope.path ? routeDistance(point, scope.path) <= scope.radius : !!scope.place && distance(scope.place, point) <= scope.radius;
}
function hazardSnapshot(scope: Scope, source: HazardNotice['source'], alerts: HazardNotice[], enabled: boolean, threshold?: number): HazardScopeSnapshot {
  // Only the changed source gets a new baseline, including after an outage.
  const thresholdSignature = threshold === undefined ? '' : `:threshold:${threshold}`;
  return { id: `${scope.id}:${source}`, label: scope.label, signature: `${scope.signature}:${source}:${enabled}${thresholdSignature}`, alerts };
}
const advisoryThreshold = (settings: Settings, source: WeatherHazardKey) => source === 'wind'
  ? settings.windGustThresholdKph : source === 'rain' ? settings.rainThresholdMmH : undefined;
export async function collectHazardSnapshots(settings: Settings, trip: Trip | null, currentLocation?: Pick<Place, 'latitude' | 'longitude'> | null) {
  const snapshots: HazardScopeSnapshot[] = [], errors: string[] = [];
  const scopes = scopesFor(settings, trip, currentLocation);
  if (!settings.currentLocationAlerts) {
    for (const source of ['fireDanger', ...reportSources, 'lightning', 'hail', 'wind', 'rain'] as const) {
      snapshots.push({
        id: `current-location:${source}`,
        label: 'Current location',
        signature: `disabled:${source}`,
        alerts: [],
      });
    }
  }
  if (!scopes.length) return { snapshots, errors };

  // Establish geography independently of feed health. Unlocated NSW warnings
  // must not become nationwide alerts, nor may unsupported areas clear history.
  const scopeCoverage = new Map(await Promise.all(scopes.map(async scope => {
    const points = await checkWarningCoverage(scope.points);
    const summary = summarizeCoverage(points);
    if (summary.status !== 'nsw') errors.push(`${scope.label}: ${coverageMessage(points)} Sources: ${nswWarningSources}.`);
    return [scope.id, { points, summary }] as const;
  })));
  const needsFeeds = settings.alertHazards.fireDanger || reportSources.some(key => settings.alertHazards[key]);
  let feeds: Awaited<ReturnType<typeof getCompanionFeeds>> | null = null;
  if (needsFeeds) {
    try { feeds = await getCompanionFeeds(); }
    catch { errors.push('Alertify hazard feeds could not be checked.'); }
  }
  if (feeds) {
    if (!settings.alertHazards.fireDanger) {
      snapshots.push(...scopes.map(scope => hazardSnapshot(scope, 'fireDanger', [], false)));
    } else {
      if (feeds.fireRatings.status !== 'live' || feeds.fireRatings.freshness?.status !== 'current') errors.push(feeds.fireRatings.error || 'Fire danger ratings are not current.');
      else {
        const matches = await Promise.all(scopes.map(async scope => {
          const coverage = scopeCoverage.get(scope.id)!;
          if (!coverage.summary.nsw) return null;
          const results = coverage.points.filter(point => point.area === 'nsw').map(point => point.district);
          if (results.some(result => !result || !['matched', 'outside_nsw'].includes(result.status))) {
            errors.push(`${scope.label}: a current fire-danger district could not be confirmed.`);
            return null;
          }
          const districts = new Set(results.filter(result => result?.status === 'matched' && result.district).map(result => result!.district!));
          const alerts = [...districts].flatMap(name => {
            const district = feeds!.fireRatings.districts.find(item => item.name === name);
            if (!district) return [];
            return [{
              source: 'fireDanger' as const,
              id: `${name}:${district.today}:${district.totalFireBan ? 'ban' : 'no-ban'}`,
              title: `Fire danger · ${district.name}`,
              body: `${district.today}${district.totalFireBan ? ' · Total fire ban today' : ''}`,
            }];
          });
          // Do not confirm a disappearance while any checked area is unsupported.
          return alerts.length || coverage.summary.status === 'nsw' ? hazardSnapshot(scope, 'fireDanger', alerts, true) : null;
        }));
        snapshots.push(...matches.filter((match): match is HazardScopeSnapshot => match !== null));
      }
    }
    for (const sourceId of reportSources) {
      if (!settings.alertHazards[sourceId]) {
        snapshots.push(...scopes.map(scope => hazardSnapshot(scope, sourceId, [], false)));
        continue;
      }
      const source = feeds.sources.find(item => item.id === sourceId);
      if (!source || !['live', 'partial'].includes(source.status) || source.freshness?.status !== 'current') {
        errors.push(source?.error || `${source?.name ?? sourceId} is not current.`);
        continue;
      }
      if (source.status === 'partial') errors.push(source.error || `${source.name} has incomplete source layers.`);
      for (const scope of scopes) {
        const coverage = scopeCoverage.get(scope.id)!;
        if (!coverage.summary.nsw) continue;
        const alerts = source.reports.filter(report => report.freshness?.status === 'current').filter(report => {
          if (!reportMatches(scope, report, sourceId)) return false;
          return sourceId === 'tfnsw' || report.severity >= minimumSeverity(scope.level);
        }).map(report => ({
          source: sourceId,
          id: `${report.id}:${report.category}`,
          title: report.title,
          body: sourceId === 'bom'
            ? `NSW-wide warning · its area is not geocoded by Alertify. ${report.category}`
            : `${report.category} · ${report.location}`,
        }));
        if (alerts.length || (coverage.summary.status === 'nsw' && source.status === 'live')) {
          snapshots.push(hazardSnapshot(scope, sourceId, alerts, true));
        }
      }
    }
  } else {
    // A deliberate opt-out updates the baseline so re-enabling a source does
    // not replay reports that arrived while it was disabled.
    for (const scope of scopes) {
      for (const source of ['fireDanger', ...reportSources] as const) {
        if (!settings.alertHazards[source]) snapshots.push(hazardSnapshot(scope, source, [], false));
      }
    }
  }

  const selectedWeather = alertHazardOptions.filter((option): option is WeatherHazardOption => isWeatherHazard(option.key) && settings.alertHazards[option.key]);
  const disabledWeather = alertHazardOptions.filter((option): option is WeatherHazardOption => isWeatherHazard(option.key) && !settings.alertHazards[option.key]);
  for (const scope of scopes) for (const option of disabledWeather) snapshots.push(hazardSnapshot(scope, option.key, [], false, advisoryThreshold(settings, option.key)));
  if (selectedWeather.length) {
    const points = [...new Map(scopes.flatMap(scope => scope.points).map(point => [
      `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`, point,
    ])).values()];
    const batches = Array.from({ length: Math.ceil(points.length / 5) }, (_, index) => points.slice(index * 5, index * 5 + 5));
    const weatherResults: Awaited<ReturnType<typeof getCompanionWeather>>[] = [];
    for (const batch of batches) {
      try {
        weatherResults.push(await getCompanionWeather({
          points: batch.map(point => `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`).join(';'),
        }));
      } catch { errors.push('Xweather sources could not be checked.'); }
    }
    const sourceHealthy = (id: string) => weatherResults.some(result => result.sources.some(source =>
      source.id === id && ['live', 'partial'].includes(source.status) && source.freshness?.status === 'current' && source.availablePoints > 0));
    const newest = weatherResults.reduce((latest, result) => Math.max(latest, Date.parse(result.fetchedAt)), 0);
    const weatherFresh = newest > 0 && Date.now() - newest < 10 * 60000;
    for (const option of selectedWeather) {
      if (!weatherFresh || !sourceHealthy(option.key)) {
        errors.push(`${option.label} is not current.`);
        continue;
      }
      for (const scope of scopes) {
        const alerts: HazardNotice[] = [];
        for (const result of weatherResults) {
          for (const event of result.events) {
            if (event.kind !== option.key || (event.validTo && Date.parse(event.validTo) < Date.now())) continue;
            if (event.kind === 'lightning' && Date.now() - Date.parse(event.validFrom) > 60 * 60000) continue;
            if (!eventInScope(event, scope.place, scope.path, scope.radius)) continue;
            alerts.push({
              source: option.key, id: event.id,
              title: event.kind === 'lightning' ? 'Lightning detected nearby' : 'Xweather hail threat',
              body: event.description || `${option.label} intersecting ${scope.label}`,
            });
          }
        }
        if (option.key === 'wind' || option.key === 'rain') {
          const threshold = option.key === 'wind' ? settings.windGustThresholdKph : settings.rainThresholdMmH;
          for (const result of weatherResults) for (const sample of result.samples) {
            const samplePoint = { latitude: sample.latitude, longitude: sample.longitude };
            const inScope = scope.path ? routeDistance(samplePoint, scope.path) <= scope.radius : !!scope.place && distance(scope.place, samplePoint) <= scope.radius;
            if (!inScope) continue;
            const observedAt = option.key === 'wind' ? sample.windTime : sample.rainTime;
            const observedAge = observedAt ? Date.now() - Date.parse(observedAt) : Infinity;
            const maxAgeMinutes = option.key === 'wind' ? 30 : 15;
            if (!Number.isFinite(observedAge) || observedAge > maxAgeMinutes * 60000) continue;
            const value = option.key === 'wind' ? sample.windGustKph : sample.rainPeakMmH;
            if (value === null || value === undefined || value < threshold) continue;
            if (option.key === 'rain' && sample.rainEnd && Date.parse(sample.rainEnd) < Date.now()) continue;
            alerts.push({
              source: option.key, id: `${scope.id}:threshold-active`,
              title: option.key === 'wind' ? 'Strong wind gusts nearby' : 'Heavy rain forecast nearby',
              body: option.key === 'wind' ? `Xweather gust estimate ${Math.round(value)} km/h · ${observedAt}` : `Xweather peak hourly rain estimate ${value.toFixed(1)} mm/h · ${observedAt}`,
            });
          }
        }
        const unique = [...new Map(alerts.map(alert => [alert.id, alert])).values()];
        snapshots.push(hazardSnapshot(scope, option.key, unique, true, advisoryThreshold(settings, option.key)));
      }
    }
  }
  return { snapshots, errors: [...new Set(errors)] };
}
