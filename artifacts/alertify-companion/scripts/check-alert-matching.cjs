const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const context = { exports: {}, require: name => mocks[name] ?? require(name), Date, Math, Map, Set, console };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, context);
  return context.exports;
}

async function run() {
  const model = load('lib/model.ts');
  const { advanceMonitor, advanceHazardMonitor } = load('lib/monitor-state.ts', { './model': model });
  const legacy = model.normalizeSettings({ notifications: true, background: true });
  assert.equal(legacy.windGustThresholdKph, 90);
  assert.equal(legacy.rainThresholdMmH, 20);
  assert.equal(legacy.alertHazards.wind, false, 'Migration does not subscribe legacy users to wind');
  assert.equal(legacy.alertHazards.rain, false, 'Migration does not subscribe legacy users to rain');
  assert.equal(legacy.notifications, true);
  assert.equal(legacy.background, true);
  assert.equal(legacy.currentLocationAlerts, false, 'Existing users are not opted in to current-location tracking');
  assert.equal(legacy.currentLocationRadiusKm, 10);
  for (const value of [null, '', '10', 0, -1, 1.5, 51]) {
    assert.throws(() => model.normalizeSettings({ currentLocationRadiusKm: value }), /1 to 50 km/, `Current-location radius rejects ${String(value)}`);
  }
  for (const value of [1, 50]) assert.equal(model.normalizeSettings({ currentLocationRadiusKm: value }).currentLocationRadiusKm, value);
  for (const [key, limit] of Object.entries(model.advisoryThresholdLimits)) {
    for (const value of [null, '', '90', NaN, Infinity, -Infinity, 0, -1, limit.min - 1, limit.max + 1, limit.min + 0.5]) {
      assert.throws(() => model.normalizeSettings({ [key]: value }), /whole number/, `${key} rejects ${String(value)}`);
    }
    for (const value of [limit.min, limit.max]) assert.equal(model.normalizeSettings({ [key]: value })[key], value);
  }
  const now = new Date().toISOString();
  const currentFreshness = { status: 'current', maxAgeMinutes: 30, ageMinutes: 0 };
  const staleFreshness = { status: 'stale', maxAgeMinutes: 30, ageMinutes: 31 };
  const feeds = {
    fireRatings: { status: 'live', freshness: currentFreshness, districts: [{ name: 'Greater Sydney Region', today: 'High', tomorrow: 'High', totalFireBan: true }] },
    sources: [
      { id: 'tfnsw', name: 'TfNSW', status: 'live', freshness: currentFreshness, reports: [
        { id: 'near-road', title: 'Nearby closure', category: 'Changed traffic conditions', location: 'Sydney', latitude: -33.86, longitude: 151.2, severity: 0, freshness: currentFreshness },
        { id: 'far-road', title: 'Distant closure', category: 'Changed traffic conditions', location: 'Dubbo', latitude: -32.25, longitude: 148.6, severity: 0, freshness: currentFreshness },
        { id: 'stale-road', title: 'Outdated closure', category: 'Changed traffic conditions', location: 'Sydney', latitude: -33.86, longitude: 151.2, severity: 0, freshness: staleFreshness },
      ] },
      { id: 'bom', name: 'BOM', status: 'live', freshness: currentFreshness, reports: [
        { id: 'nsw-warning', title: 'Severe NSW warning', category: 'Weather warning', location: 'NSW warning feed', latitude: null, longitude: null, severity: 2, freshness: currentFreshness },
      ] },
      { id: 'ses', name: 'SES', status: 'live', freshness: currentFreshness, reports: [
        { id: 'near-ses', title: 'Local evacuation notice', category: 'Emergency Warning', location: 'Sydney', latitude: -33.86, longitude: 151.2, severity: 3, freshness: currentFreshness },
        { id: 'unlocated-ses', title: 'Unlocated notice', category: 'Watch and Act', location: 'Area unavailable', latitude: null, longitude: null, severity: 2, freshness: currentFreshness },
      ] },
    ],
  };
  const weather = {
    fetchedAt: now,
    sources: ['lightning', 'hail', 'wind', 'rain'].map(id => ({ id, status: 'live', freshness: currentFreshness, availablePoints: 1 })),
    events: [
      { id: 'near-lightning', kind: 'lightning', latitude: -33.86, longitude: 151.2, polygon: [], description: 'Nearby strike', validFrom: now, validTo: '' },
      { id: 'far-lightning', kind: 'lightning', latitude: -34.3, longitude: 150.9, polygon: [], description: 'Distant strike', validFrom: now, validTo: '' },
      { id: 'near-hail', kind: 'hail', latitude: -33.86, longitude: 151.2, polygon: [], description: 'Nearby hail period', validFrom: now, validTo: new Date(Date.now() + 3600000).toISOString() },
    ],
    samples: [
      { latitude: -33.86, longitude: 151.2, windTime: now, windGustKph: 95, rainTime: now, rainEnd: new Date(Date.now() + 3600000).toISOString(), rainPeakMmH: 25 },
      { latitude: -33.86, longitude: 151.2, windTime: new Date(Date.now() - 31 * 60000).toISOString(), windGustKph: 150, rainTime: new Date(Date.now() - 16 * 60000).toISOString(), rainEnd: new Date(Date.now() + 3600000).toISOString(), rainPeakMmH: 50 },
      { latitude: -34.3, longitude: 150.9, windTime: now, windGustKph: 120, rainTime: now, rainEnd: now, rainPeakMmH: 40 },
    ],
  };
  const client = {
    getCompanionFeeds: async () => feeds,
    getCompanionFireDistrict: async () => ({ status: 'matched', district: 'Greater Sydney Region' }),
    getCompanionWeather: async () => weather,
  };
  const geometry = {
    routeSamples: coordinates => coordinates.slice(0, 1).map(([longitude, latitude]) => ({ latitude, longitude })),
    eventInScope: (event, zone, path, radius) => zone
      ? model.distance(zone, { latitude: event.latitude, longitude: event.longitude }) <= radius
      : !!path && model.routeDistance({ latitude: event.latitude, longitude: event.longitude }, path) <= radius,
  };
  const { collectHazardSnapshots } = load('lib/hazard-monitor.ts', {
    '@workspace/api-client-react': client,
    './model': model,
    './weather-geometry': geometry,
    './warning-coverage': load('lib/warning-coverage.ts', { '@workspace/api-client-react': client }),
  });
  const place = { name: 'Sydney', detail: 'NSW', latitude: -33.86, longitude: 151.2 };
  const settings = model.normalizeSettings({
    ...model.defaultSettings,
    watch: true, homeLevel: 'significant',
    watches: [{ id: 'home', label: 'Home', place, radius: 10, enabled: true }],
    activeWatchId: 'home', alertHazards: { ...model.defaultAlertHazards },
  });
  const checked = await collectHazardSnapshots(settings, null);
  assert.equal(checked.errors.length, 0);
  const alerts = new Map(checked.snapshots.map(snapshot => [snapshot.id.split(':').at(-1), snapshot.alerts]));
  assert.equal(JSON.stringify(alerts.get('tfnsw').map(alert => alert.id)), JSON.stringify(['near-road:Changed traffic conditions']));
  assert.equal(alerts.get('tfnsw').some(alert => alert.id.startsWith('stale-road')), false, 'Stale warning records are excluded from trip alerts');
  assert.equal(alerts.get('bom').length, 1, 'Ungeocoded BOM warnings are labelled and retained as statewide alerts');
  assert.equal(JSON.stringify(alerts.get('ses').map(alert => alert.id)), JSON.stringify(['near-ses:Emergency Warning']), 'Ungeocoded SES alerts are not guessed to be local');
  assert.match(alerts.get('fireDanger')[0].body, /Total fire ban/);
  assert.equal(JSON.stringify(alerts.get('lightning').map(alert => alert.id)), JSON.stringify(['near-lightning']));
  assert.equal(JSON.stringify(alerts.get('hail').map(alert => alert.id)), JSON.stringify(['near-hail']));
  assert.match(alerts.get('wind')[0].body, /95 km\/h/);
  assert.match(alerts.get('rain')[0].body, /25\.0 mm\/h/);
  const tfnsw = feeds.sources.find(source => source.id === 'tfnsw');
  const priorFreshness = tfnsw.freshness;
  const priorStatus = tfnsw.status;
  tfnsw.freshness = staleFreshness;
  tfnsw.status = 'stale';
  const staleSourceResult = await collectHazardSnapshots(settings, null);
  assert.equal(staleSourceResult.snapshots.some(item => item.id === 'watch:home:tfnsw'), false, 'A stale source does not create trip-alert snapshots');
  assert.equal(staleSourceResult.errors.some(error => error.includes('not current')), true, 'A stale source is surfaced as an error');
  tfnsw.freshness = priorFreshness;
  tfnsw.status = priorStatus;
  const liveSettings = model.normalizeSettings({
    ...settings, watch: false, watches: [], activeWatchId: null,
    currentLocationAlerts: true, currentLocationRadiusKm: 10,
  });
  const liveChecked = await collectHazardSnapshots(liveSettings, null, place);
  assert.equal(liveChecked.errors.length, 0);
  assert.equal(liveChecked.snapshots.some(item => item.id === 'current-location:tfnsw'), true);
  assert.equal(liveChecked.snapshots.find(item => item.id === 'current-location:tfnsw').alerts.length, 1, 'Current position scopes match nearby mapped reports');
  assert.equal(liveChecked.snapshots.find(item => item.id === 'current-location:ses').alerts.length, 1);
  assert.equal(liveChecked.snapshots.find(item => item.id === 'current-location:bom').alerts.length, 1, 'Ungeocoded BOM remains statewide');
  const liveRfsIncident = { id: 'nearby-rfs', category: 'Fire', type: 'Bush fire', title: 'Nearby incident', latitude: place.latitude, longitude: place.longitude, severity: 3 };
  const farRfsIncident = { ...liveRfsIncident, id: 'distant-rfs', latitude: -32.25, longitude: 148.6 };
  const liveBaseline = advanceMonitor(liveSettings, null, [liveRfsIncident], null, place);
  assert.equal(liveBaseline.fresh.length, 0, 'First current-location check establishes a baseline');
  const liveNext = advanceMonitor(liveSettings, null, [liveRfsIncident, farRfsIncident], liveBaseline.state, place);
  assert.equal(liveNext.fresh.length, 0, 'Distant incidents do not trigger live-radius alerts');
  const newNearby = { ...liveRfsIncident, id: 'new-nearby-rfs' };
  const liveNew = advanceMonitor(liveSettings, null, [liveRfsIncident, farRfsIncident, newNearby], liveNext.state, place);
  assert.equal(JSON.stringify(liveNew.fresh.map(item => item.id)), JSON.stringify(['new-nearby-rfs']));
  const movedAway = { ...place, latitude: place.latitude + 1 };
  const entered = advanceMonitor(liveSettings, null, [farRfsIncident], liveNew.state, farRfsIncident);
  assert.equal(entered.fresh.length, 1, 'Entering the radius of an existing incident generates an alert');
  const left = advanceMonitor(liveSettings, null, [farRfsIncident], entered.state, movedAway);
  assert.equal(left.fresh.length, 0, 'Leaving a radius does not alert');
  assert.equal(advanceMonitor(liveSettings, null, [farRfsIncident], left.state, farRfsIncident).fresh.length, 1, 'Returning after leaving can alert again');
  const changedRadius = model.normalizeSettings({ ...liveSettings, currentLocationRadiusKm: 50 });
  assert.equal(advanceMonitor(changedRadius, null, [newNearby], liveNew.state, place).fresh.length, 0, 'Changing radius establishes a baseline without replay');
  const beforeOutage = advanceMonitor(liveSettings, null, [liveRfsIncident, farRfsIncident], null, place);
  const missingFix = advanceMonitor(liveSettings, null, [liveRfsIncident, farRfsIncident], beforeOutage.state, null);
  assert.equal(missingFix.fresh.length, 0, 'No current-location alert is guessed during a GPS outage');
  assert.equal(JSON.stringify(missingFix.state.scopes['current-location']), JSON.stringify(beforeOutage.state.scopes['current-location']), 'An unavailable fix preserves the last RFS current-location baseline');
  const recoveredFix = advanceMonitor(liveSettings, null, [liveRfsIncident, farRfsIncident], missingFix.state, farRfsIncident);
  assert.equal(JSON.stringify(recoveredFix.fresh.map(item => item.id)), JSON.stringify(['distant-rfs']), 'Moving into an existing incident during an outage alerts when GPS recovers');
  const disabledLive = advanceMonitor({ ...liveSettings, currentLocationAlerts: false }, null, [liveRfsIncident, farRfsIncident], beforeOutage.state, null);
  assert.equal(disabledLive.state.scopes['current-location'], undefined, 'Explicit opt-out clears the baseline, unlike GPS loss');
  assert.equal(advanceMonitor(liveSettings, null, [liveRfsIncident, farRfsIncident], disabledLive.state, farRfsIncident).fresh.length, 0, 'Explicit re-enable still establishes a baseline without replay');
  const { isUsableLocation, shouldRunTripLocation } = load('lib/location-policy.ts', { './model': model });
  const fixNow = Date.now();
  const locationFix = { timestamp: fixNow, coords: { ...place, accuracy: 50 } };
  assert.equal(isUsableLocation(locationFix, 1, fixNow), true);
  assert.equal(isUsableLocation({ ...locationFix, timestamp: fixNow - 120001 }, 10, fixNow), false, 'Stale positions are not used');
  assert.equal(isUsableLocation({ ...locationFix, coords: { ...place, accuracy: 251 } }, 1, fixNow), false, 'One-km checks reject low-accuracy positions');
  assert.equal(isUsableLocation({ ...locationFix, coords: { ...place, accuracy: null } }, 50, fixNow), false);
  assert.equal(isUsableLocation({ ...locationFix, coords: { ...place, latitude: NaN, accuracy: 10 } }, 50, fixNow), false);
  assert.equal(isUsableLocation(null, 10, fixNow), false);
  const activeTrip = { startedAt: Date.now(), coordinates: [], start: place, destination: place };
  const backgroundSettings = model.normalizeSettings({ ...liveSettings, notifications: true, tripBackgroundLocation: true });
  assert.equal(shouldRunTripLocation(backgroundSettings, activeTrip), true);
  for (const flag of ['notifications', 'currentLocationAlerts', 'tripBackgroundLocation']) {
    assert.equal(shouldRunTripLocation({ ...backgroundSettings, [flag]: false }, activeTrip), false, `${flag} off stops trip location`);
  }
  assert.equal(shouldRunTripLocation(backgroundSettings, null), false, 'Ending a trip stops location');
  assert.equal(shouldRunTripLocation(backgroundSettings, { ...activeTrip, startedAt: Date.now() - 86400001 }), false, 'Expired trips stop location');
  const liveWithWatch = model.normalizeSettings({ ...settings, currentLocationAlerts: true, currentLocationRadiusKm: 10 });
  const watchBaseline = advanceMonitor(liveSettings, null, [liveRfsIncident], null, place);
  const enabledLiveScope = advanceMonitor(liveWithWatch, null, [liveRfsIncident], watchBaseline.state, place);
  assert.equal(enabledLiveScope.fresh.length, 0, 'Adding a live-location scope does not replay an incident already in a watch zone');
  const baselineScope = { id: 'watch:home:tfnsw', label: 'Home', signature: 'watch-signature', alerts: [{ source: 'tfnsw', id: 'same-report', title: 'Report', body: 'Near home' }] };
  const emptyLocationScope = { id: 'current-location:tfnsw', label: 'Current location', signature: 'empty', alerts: [] };
  const crossScopeBaseline = advanceHazardMonitor([baselineScope, emptyLocationScope], null);
  const duplicateLocationScope = { ...emptyLocationScope, signature: 'live', alerts: [{ ...baselineScope.alerts[0] }] };
  assert.equal(advanceHazardMonitor([baselineScope, duplicateLocationScope], crossScopeBaseline.state).fresh.length, 0, 'A report already seen in a watch zone is not duplicated by live radius');
  const disabledLocationScope = { ...emptyLocationScope, signature: 'disabled:tfnsw' };
  const disabledLocationState = advanceHazardMonitor([disabledLocationScope], crossScopeBaseline.state).state;
  assert.equal(advanceHazardMonitor([duplicateLocationScope], disabledLocationState).fresh.length, 0, 'Re-enabling live location establishes a new baseline');
  const changedSettings = (windGustThresholdKph, rainThresholdMmH) => model.normalizeSettings({
    ...settings, windGustThresholdKph, rainThresholdMmH,
  });
  const atBoundary = await collectHazardSnapshots(changedSettings(95, 25), null);
  const snapshot = (result, key, scope = 'watch:home') => result.snapshots.find(item => item.id === `${scope}:${key}`);
  assert.equal(snapshot(atBoundary, 'wind').alerts.length, 1, 'Wind matches exactly at the chosen threshold');
  assert.equal(snapshot(atBoundary, 'rain').alerts.length, 1, 'Rain matches exactly at the chosen threshold');
  const above = await collectHazardSnapshots(changedSettings(96, 26), null);
  assert.equal(snapshot(above, 'wind').alerts.length, 0);
  assert.equal(snapshot(above, 'rain').alerts.length, 0);
  const lowered = await collectHazardSnapshots(changedSettings(80, 10), null);
  const baseline = advanceHazardMonitor(above.snapshots, null);
  const rebased = advanceHazardMonitor(lowered.snapshots, baseline.state);
  assert.equal(rebased.fresh.length, 0, 'Lowering thresholds does not replay currently active wind/rain');
  assert.equal(advanceHazardMonitor(lowered.snapshots, rebased.state).fresh.length, 0, 'Repeated checks stay quiet');
  const cleared = advanceHazardMonitor(above.snapshots.map(item => ({
    ...item, signature: lowered.snapshots.find(next => next.id === item.id).signature,
  })), rebased.state);
  assert.equal(advanceHazardMonitor(lowered.snapshots, cleared.state).fresh.length, 2, 'New crossings after an all-clear alert normally');
  const windOnly = await collectHazardSnapshots(changedSettings(80, 20), null);
  for (const key of ['rain', 'bom', 'rfs', 'lightning', 'hail', 'ses', 'tfnsw', 'fireDanger']) {
    if (snapshot(checked, key)) assert.equal(snapshot(windOnly, key).signature, snapshot(checked, key).signature, `Changing wind does not reset ${key}`);
  }
  const rainOnly = await collectHazardSnapshots(changedSettings(90, 10), null);
  assert.equal(snapshot(rainOnly, 'wind').signature, snapshot(checked, 'wind').signature);
  assert.notEqual(snapshot(rainOnly, 'rain').signature, snapshot(checked, 'rain').signature);
  const trip = {
    start: place, destination: { ...place, name: 'Destination' },
    coordinates: [[151.2, -33.86], [151.21, -33.86]], startedAt: Date.now(),
  };
  const tripAbove = await collectHazardSnapshots(changedSettings(96, 26), trip);
  const tripLowered = await collectHazardSnapshots(changedSettings(80, 10), trip);
  const tripScope = `trip:${trip.startedAt}`;
  assert.equal(snapshot(tripAbove, 'wind', tripScope).alerts.length, 0);
  assert.equal(snapshot(tripLowered, 'wind', tripScope).alerts.length, 1);
  assert.equal(snapshot(tripLowered, 'rain', tripScope).alerts.length, 1);
  assert.equal(advanceHazardMonitor(tripLowered.snapshots, advanceHazardMonitor(tripAbove.snapshots, null).state).fresh.length, 0, 'Trip thresholds also establish a fresh baseline');
  const optedOut = model.normalizeSettings({
    ...settings, notifications: false, background: false, quietHours: true,
    alertHazards: { ...settings.alertHazards, wind: false, rain: false, bom: false },
  });
  const saved = model.normalizeSettings(JSON.parse(JSON.stringify({
    ...optedOut, windGustThresholdKph: 80, rainThresholdMmH: 10,
  })));
  assert.equal(saved.windGustThresholdKph, 80);
  assert.equal(saved.rainThresholdMmH, 10);
  assert.equal(JSON.stringify(saved.alertHazards), JSON.stringify(optedOut.alertHazards));
  for (const key of ['notifications', 'background', 'quietHours', 'homeLevel', 'tripLevel']) assert.equal(saved[key], optedOut[key]);
  const disabled = await collectHazardSnapshots(saved, trip);
  assert.equal(snapshot(disabled, 'wind').alerts.length, 0);
  assert.equal(snapshot(disabled, 'rain', tripScope).alerts.length, 0);
  const muted = model.normalizeSettings({ ...settings, alertHazards: { ...settings.alertHazards, tfnsw: false } });
  const mutedResult = await collectHazardSnapshots(muted, null);
  assert.equal(mutedResult.snapshots.find(snapshot => snapshot.id === 'watch:home:tfnsw').alerts.length, 0);
  feeds.sources.find(source => source.id === 'tfnsw').status = 'stale';
  const stale = await collectHazardSnapshots(settings, null);
  assert.equal(stale.snapshots.some(snapshot => snapshot.id === 'watch:home:tfnsw'), false, 'Stale feeds do not advance a false all-clear baseline');
  assert.equal(stale.errors.some(error => /TfNSW/.test(error)), true, 'Unavailable selected source is reported to the user');
  const coverage = load('lib/warning-coverage.ts', { '@workspace/api-client-react': client });
  assert.equal(coverage.coverageArea(null), 'unknown');
  assert.equal(coverage.coverageArea({ status: 'unavailable', lga: null }), 'unknown');
  assert.equal(coverage.coverageArea({ status: 'stale', lga: 'Sydney' }), 'nsw', 'Geographic coverage is independent of rating freshness');
  assert.equal(coverage.coverageArea({ status: 'ambiguous', lga: 'Border council' }), 'nsw');
  for (const [areas, status] of [
    [[], 'unknown'], [['nsw'], 'nsw'], [['outside'], 'unsupported'],
    [['nsw', 'outside'], 'partial'], [['nsw', 'unknown'], 'unknown'], [['outside', 'unknown'], 'unknown'],
  ]) {
    assert.equal(coverage.summarizeCoverage(areas.map(area => ({ area }))).status, status);
    assert.ok(coverage.coverageMessage(areas.map(area => ({ area }))).length > 0);
  }
  const outsideTrip = { ...trip, start: { ...place, name: 'Melbourne' }, destination: { ...place, name: 'Adelaide' } };
  client.getCompanionFireDistrict = async () => ({ status: 'outside_nsw', district: null });
  const outside = await collectHazardSnapshots({ ...settings, watch: false }, outsideTrip);
  assert.equal(snapshot(outside, 'bom', tripScope), undefined, 'NSW-wide BOM headlines are not applied to a wholly unsupported trip');
  assert.equal(snapshot(outside, 'fireDanger', tripScope), undefined, 'Unsupported fire danger does not confirm an empty check');
  assert.ok(outside.errors.some(error => /unsupported/.test(error) && /TfNSW/.test(error) && /RFS/.test(error)), 'All NSW source limits are surfaced');
  assert.ok(outside.errors.some(error => /TfNSW/.test(error)), 'Coverage does not hide a source outage');
  client.getCompanionFireDistrict = async () => { throw new Error('Boundary outage'); };
  const unknown = await collectHazardSnapshots({ ...settings, watch: false }, trip);
  assert.equal(snapshot(unknown, 'bom', tripScope), undefined, 'Boundary failures are not treated as NSW coverage');
  assert.ok(unknown.errors.some(error => /unconfirmed/.test(error)));
  // Use the actual distance-spaced route sampler for the interstate case.
  const actualGeometry = load('lib/weather-geometry.ts', { './model': model });
  const interstateCollector = load('lib/hazard-monitor.ts', {
    '@workspace/api-client-react': client, './model': model,
    './weather-geometry': actualGeometry, './warning-coverage': coverage,
  }).collectHazardSnapshots;
  client.getCompanionFireDistrict = async point => point.latitude < -36.1
    ? { status: 'outside_nsw', district: null }
    : { status: 'matched', district: 'Greater Sydney Region' };
  const interstateTrip = { ...trip, coordinates: [[151.2, -33.86], [144.96, -37.81]] };
  const interstate = await interstateCollector({ ...settings, watch: false }, interstateTrip);
  assert.ok(interstate.errors.some(error => /Partial warning coverage/.test(error)));
  assert.ok(snapshot(interstate, 'bom', tripScope).alerts.length, 'NSW headlines remain relevant to the NSW portion of an interstate route');
  feeds.sources.find(source => source.id === 'bom').reports = [];
  const emptyPartial = await interstateCollector({ ...settings, watch: false }, interstateTrip);
  assert.equal(snapshot(emptyPartial, 'bom', tripScope), undefined, 'A partially covered empty check does not confirm clearance');
  feeds.sources.find(source => source.id === 'bom').status = 'stale';
  const partialOutage = await interstateCollector({ ...settings, watch: false }, interstateTrip);
  assert.ok(partialOutage.errors.some(error => /Partial warning coverage/.test(error)));
  assert.ok(partialOutage.errors.some(error => /BOM/.test(error)), 'Freshness errors remain alongside geographic gaps');
  console.log('PASS: selected feeds, current-location scope, cross-scope dedupe, source status, zone/trip matching, validated settings, migration opt-ins, inclusive thresholds and no replay after scope changes.');
  console.log('PASS: NSW/interstate/outside/unknown warning coverage, statewide BOM eligibility, partial empty checks and preserved source outages.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
