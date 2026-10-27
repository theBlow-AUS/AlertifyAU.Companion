import { type Settings, type Trip, type Incident, distance, routeDistance, matchesLevel, isCurrentTrip } from './model';

export type MonitorState = { scopes: Record<string, { signature: string; seen: string[] }> };
export type HazardSource = 'fireDanger' | 'tfnsw' | 'bom' | 'ses' | 'lightning' | 'hail' | 'wind' | 'rain';
export type HazardNotice = { source: HazardSource; id: string; title: string; body: string };
export type HazardScopeSnapshot = { id: string; label: string; signature: string; alerts: HazardNotice[] };
export type HazardMonitorState = { scopes: Record<string, { signature: string; seen: string[] }> };

export function advanceHazardMonitor(snapshots: HazardScopeSnapshot[], previous: HazardMonitorState | null) {
  const scopes = { ...(previous?.scopes ?? {}) };
  const fresh = new Map<string, HazardNotice & { labels: Set<string> }>();
  for (const snapshot of snapshots) {
    const old = previous?.scopes?.[snapshot.id];
    const seen = [...new Set(snapshot.alerts.map(alert => alert.id))].slice(-300);
    if (old?.signature === snapshot.signature) for (const alert of snapshot.alerts) {
      if (old.seen.includes(alert.id)) continue;
      const key = `${alert.source}:${alert.id}`;
      const existing = fresh.get(key);
      if (existing) existing.labels.add(snapshot.label);
      else fresh.set(key, { ...alert, labels: new Set([snapshot.label]) });
    }
    scopes[snapshot.id] = { signature: snapshot.signature, seen };
  }
  // Bound old route/watch history without dropping state for currently checked scopes.
  const active = new Set(snapshots.map(snapshot => snapshot.id));
  for (const key of Object.keys(scopes)) if (!active.has(key) && Object.keys(scopes).length > 120) delete scopes[key];
  return {
    state: { scopes } as HazardMonitorState,
    fresh: [...fresh.values()].map(({ labels, ...alert }) => ({
      ...alert, scopeLabels: [...labels].slice(0, 3), moreScopes: Math.max(0, labels.size - 3),
    })),
  };
}

export function advanceMonitor(settings: Settings, trip: Trip | null, incidents: Incident[], previous: MonitorState | null) {
  const scopes: { id: string; signature: string; matches: Incident[] }[] = [];
  if (settings.watch) {
    for (const w of settings.watches.filter(w => w.enabled)) {
      scopes.push({
        id: `watch:${w.id}`, signature: JSON.stringify([w.place.latitude, w.place.longitude, w.radius, settings.homeLevel]),
        matches: incidents.filter(i => distance(w.place, i) <= w.radius && matchesLevel(i, settings.homeLevel)),
      });
    }
  }
  if (isCurrentTrip(trip)) scopes.push({
    id: `trip:${trip.startedAt}`, signature: JSON.stringify([trip.coordinates, settings.tripLevel]),
    matches: incidents.filter(i => routeDistance(i, trip.coordinates) <= 5 && matchesLevel(i, settings.tripLevel)),
  });
  const next: MonitorState = { scopes: {} };
  const fresh = new Map<string, Incident>();
  for (const scope of scopes) {
    const seen = scope.matches.map(i => `${i.id}:${i.category}`);
    const old = previous?.scopes?.[scope.id];
    if (old?.signature === scope.signature) scope.matches.forEach((i, index) => {
      if (!old.seen.includes(seen[index])) fresh.set(seen[index], i);
    });
    next.scopes[scope.id] = { signature: scope.signature, seen };
  }
  return { state: next, fresh: [...fresh.values()] };
}
