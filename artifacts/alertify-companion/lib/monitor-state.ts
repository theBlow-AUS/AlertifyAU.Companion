import { type Settings, type Trip, type Incident, distance, routeDistance, matchesLevel, isCurrentTrip } from './model';

export type MonitorState = {
  scopes: Record<string, { signature: string; seen: string[] }>;
  // Keep incident identity across scope changes so a new/returning trip can
  // detect unseen incidents without replaying ones already handled elsewhere.
  observed?: string[];
};
export type HazardSource = 'fireDanger' | 'tfnsw' | 'bom' | 'ses' | 'lightning' | 'hail' | 'wind' | 'rain';
export type HazardNotice = { source: HazardSource; id: string; title: string; body: string };
export type HazardScopeSnapshot = { id: string; label: string; signature: string; alerts: HazardNotice[] };
export type HazardMonitorState = {
  scopes: Record<string, { signature: string; seen: string[] }>;
  // Source-qualified IDs prevent a report being repeated after scope changes.
  observed?: string[];
};

export function advanceHazardMonitor(snapshots: HazardScopeSnapshot[], previous: HazardMonitorState | null) {
  const scopes = { ...(previous?.scopes ?? {}) };
  const fresh = new Map<string, HazardNotice & { labels: Set<string> }>();
  const observedBefore = new Set(previous?.observed ?? Object.entries(previous?.scopes ?? {}).flatMap(([scopeId, scope]) => {
    const source = scopeId.split(':').at(-1);
    return source ? scope.seen.map(id => `${source}:${id}`) : [];
  }));
  const activeNow = new Set(snapshots.flatMap(snapshot => {
    const source = snapshot.id.split(':').at(-1);
    return source ? snapshot.alerts.map(alert => `${source}:${alert.id}`) : [];
  }));
  // A matching, still-checked scope reporting an alert's disappearance means
  // it cleared. A removed trip scope is not a clear; retain its history for a
  // later resume so the same ongoing hazard is not repeated.
  for (const [scopeId, old] of Object.entries(previous?.scopes ?? {})) {
    const current = snapshots.find(snapshot => snapshot.id === scopeId);
    if (!current || current.signature !== old.signature) continue;
    const source = scopeId.split(':').at(-1);
    if (!source) continue;
    const currentIds = new Set(current.alerts.map(alert => alert.id));
    for (const id of old.seen) {
      const key = `${source}:${id}`;
      if (!currentIds.has(id) && !activeNow.has(key)) observedBefore.delete(key);
    }
  }
  const previouslySeen = observedBefore;
  for (const snapshot of snapshots) {
    const old = previous?.scopes?.[snapshot.id];
    const seen = [...new Set(snapshot.alerts.map(alert => alert.id))].slice(-300);
    // A missing scope is a trip/watch entering the check; compare against
    // history from every previous scope. Signature edits on an existing scope
    // still rebaseline, preserving settings-change behavior.
    if (previous && (!old || old.signature === snapshot.signature)) for (const alert of snapshot.alerts) {
      if (previouslySeen.has(`${alert.source}:${alert.id}`)) continue;
      const key = `${alert.source}:${alert.id}`;
      const existing = fresh.get(key);
      if (existing) existing.labels.add(snapshot.label);
      else fresh.set(key, { ...alert, labels: new Set([snapshot.label]) });
    }
    scopes[snapshot.id] = { signature: snapshot.signature, seen };
  }
  const observed = [...new Set([
    ...observedBefore,
    ...activeNow,
  ])].slice(-1000);
  // Bound old route/watch history without dropping state for currently checked scopes.
  const active = new Set(snapshots.map(snapshot => snapshot.id));
  for (const key of Object.keys(scopes)) if (!active.has(key) && Object.keys(scopes).length > 120) delete scopes[key];
  return {
    state: { scopes, observed },
    fresh: [...fresh.values()].map(({ labels, ...alert }) => ({
      ...alert, scopeLabels: [...labels].slice(0, 3), moreScopes: Math.max(0, labels.size - 3),
    })),
  };
}

export function advanceMonitor(
  settings: Settings, trip: Trip | null, incidents: Incident[], previous: MonitorState | null,
  currentLocation?: Pick<Incident, 'latitude' | 'longitude'> | null,
) {
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
  if (settings.currentLocationAlerts && currentLocation) {
    const level = isCurrentTrip(trip) ? settings.tripLevel : settings.homeLevel;
    scopes.push({
      id: 'current-location',
      signature: JSON.stringify([settings.currentLocationRadiusKm, level]),
      matches: incidents.filter(i => distance(currentLocation, i) <= settings.currentLocationRadiusKm && matchesLevel(i, level)),
    });
  }
  const next: MonitorState = { scopes: {}, observed: [] };
  const fresh = new Map<string, Incident>();
  const activeScopeIds = new Set(scopes.map(scope => scope.id));
  // A missing fix is an unavailable check, not an all-clear or an opt-out.
  // Keep the last successful baseline so movement during a GPS outage can alert
  // when a fresh fix returns. Explicit opt-out still removes this scope below.
  const pausedLocation = settings.currentLocationAlerts && !currentLocation
    ? previous?.scopes?.['current-location'] : undefined;
  if (pausedLocation) {
    next.scopes['current-location'] = pausedLocation;
    activeScopeIds.add('current-location');
  }
  const previouslyObserved = new Set([
    ...(previous?.observed ?? []),
    ...Object.values(previous?.scopes ?? {}).flatMap(scope => scope.seen),
  ]);
  for (const scope of scopes) {
    const seen = scope.matches.map(i => `${i.id}:${i.category}`);
    const old = previous?.scopes?.[scope.id];
    const currentLocationBaseline = scope.id === 'current-location' && previous && !old;
    // A new scope can alert on incidents that became newly relevant, while a
    // changed signature on an existing scope continues to establish a baseline.
    if (previous && !currentLocationBaseline && (!old || old.signature === scope.signature)) scope.matches.forEach((incident, index) => {
      if (!previouslyObserved.has(seen[index])) fresh.set(seen[index], incident);
    });
    next.scopes[scope.id] = { signature: scope.signature, seen };
  }
  next.observed = [...new Set([
    ...(previous?.observed ?? []),
    // Preserve identities from scopes that just ended (notably a trip) so
    // resuming the same hazard on another route does not notify twice.
    ...Object.entries(previous?.scopes ?? {})
      .filter(([scopeId]) => !activeScopeIds.has(scopeId))
      .flatMap(([, scope]) => scope.seen),
  ])].slice(-2000);
  return { state: next, fresh: [...fresh.values()] };
}
