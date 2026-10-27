import { getCompanionFeeds, getCompanionFireDistrict, getCompanionWeather } from '@workspace/api-client-react';
import { alertHazardOptions, distance, isCurrentTrip, routeDistance, type AlertHazardKey, type Place, type Settings, type Trip } from './model';
import { eventInScope, routeSamples } from './weather-geometry';
import type { HazardNotice, HazardScopeSnapshot } from './monitor-state';

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

function scopesFor(settings: Settings, trip: Trip | null): Scope[] {
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
  return scopes;
}
const minimumSeverity = (level: Settings['homeLevel']) => level === 'urgent' ? 3 : level === 'significant' ? 2 : 0;
function reportMatches(scope: Scope, report: { latitude: number | null; longitude: number | null }, source: string) {
  if (report.latitude === null || report.longitude === null) return source === 'bom';
  const point = { latitude: report.latitude, longitude: report.longitude };
  return scope.path ? routeDistance(point, scope.path) <= scope.radius : !!scope.place && distance(scope.place, point) <= scope.radius;
}
function hazardSnapshot(scope: Scope, source: HazardNotice['source'], alerts: HazardNotice[], enabled: boolean): HazardScopeSnapshot {
  return { id: `${scope.id}:${source}`, label: scope.label, signature: `${scope.signature}:${source}:${enabled}`, alerts };
}
const sourceEnabled = (settings: Settings, source: AlertHazardKey) => settings.alertHazards[source];
export async function collectHazardSnapshots(settings: Settings, trip: Trip | null) {
  const snapshots: HazardScopeSnapshot[] = [], errors: string[] = [];
  const scopes = scopesFor(settings, trip);
  if (!scopes.length) return { snapshots, errors };

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
      if (feeds.fireRatings.status !== 'live') errors.push(feeds.fireRatings.error || 'Fire danger ratings are not current.');
      else {
        const matches = await Promise.all(scopes.map(async scope => {
          const results = await Promise.all(scope.points.map(point => getCompanionFireDistrict({ latitude: point.latitude, longitude: point.longitude }).catch(() => null)));
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
          return hazardSnapshot(scope, 'fireDanger', alerts, true);
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
      if (!source || !['live', 'partial'].includes(source.status)) {
        errors.push(source?.error || `${source?.name ?? sourceId} is not current.`);
        continue;
      }
      for (const scope of scopes) {
        const alerts = source.reports.filter(report => {
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
        snapshots.push(hazardSnapshot(scope, sourceId, alerts, true));
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
  for (const scope of scopes) for (const option of disabledWeather) snapshots.push(hazardSnapshot(scope, option.key, [], false));
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
      source.id === id && ['live', 'partial'].includes(source.status) && source.availablePoints > 0));
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
          const threshold = option.key === 'wind' ? 90 : 20;
          for (const result of weatherResults) for (const sample of result.samples) {
            const samplePoint = { latitude: sample.latitude, longitude: sample.longitude };
            const inScope = scope.path ? routeDistance(samplePoint, scope.path) <= scope.radius : !!scope.place && distance(scope.place, samplePoint) <= scope.radius;
            if (!inScope) continue;
            const observedAt = option.key === 'wind' ? sample.windTime : sample.rainTime;
            if (!observedAt || Date.now() - Date.parse(observedAt) > 30 * 60000) continue;
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
        snapshots.push(hazardSnapshot(scope, option.key, unique, true));
      }
    }
  }
  return { snapshots, errors: [...new Set(errors)] };
}
