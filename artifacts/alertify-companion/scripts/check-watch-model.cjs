const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const context = { exports: {}, require: name => mocks[name] ?? require(name), Date, Math, Map, console };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, context);
  return context.exports;
}
const model = load('lib/model.ts');
const { advanceMonitor, advanceHazardMonitor } = load('lib/monitor-state.ts', { './model': model });
const selectedByDefault = model.normalizeSettings({ ...model.defaultSettings });
for (const source of ['rfs', 'fireDanger', 'tfnsw', 'bom', 'ses', 'lightning', 'hail', 'wind', 'rain']) {
  assert.equal(selectedByDefault.alertHazards[source], true, `New installs include the ${source} source in alert controls`);
}
assert.equal(model.normalizeSettings({ notifications: true }).alertHazards.tfnsw, false, 'Existing opt-in users are not silently subscribed to new feeds');
assert.equal(model.normalizeSettings({ alertHazards: { bom: false } }).alertHazards.rfs, true, 'Partial alert preferences preserve safe defaults');
const place = { name: 'Sydney', detail: 'NSW', latitude: -33.86, longitude: 151.2 };
const migrated = model.normalizeSettings({ home: place, radius: 25, homeLevel: 'all', tripLevel: 'urgent' });
assert.equal(migrated.watches.length, 1);
assert.equal(migrated.watches[0].label, 'Home');
assert.equal(migrated.watches[0].radius, 25);
assert.equal(migrated.homeLevel, 'all');
assert.equal(migrated.tripLevel, 'urgent');
const first = { ...migrated.watches[0], label: 'My home', radius: 5 };
const second = { ...first, id: 'office', label: 'Office', radius: 50, fireDistrict: 'Greater Sydney Region' };
const settings = model.normalizeSettings({ ...migrated, watches: [first, second], activeWatchId: 'office' });
assert.equal(settings.radius, 50);
assert.equal(settings.watches[1].fireDistrict, undefined, 'Old manually selected districts are replaced by the coordinate-based match');
assert.equal(settings.watches[0].radius, 5);
assert.equal(model.normalizeSettings(JSON.parse(JSON.stringify(settings))).watches[1].label, 'Office');
assert.equal(model.normalizeSettings({ ...settings, watches: [] }).home, null);
assert.equal(model.normalizeSettings({ ...settings, watches: [first] }).activeWatchId, first.id);
assert.throws(() => model.normalizeSettings({ watches: [{ ...first, radius: -1 }] }));
const report = { id: 'rfs-1', title: 'Incident', category: 'Watch and Act', severity: 2, latitude: -33.86, longitude: 151.2 };
const baseline = advanceMonitor(settings, null, [], null);
const detected = advanceMonitor(settings, null, [report], baseline.state);
assert.equal(detected.fresh.length, 1, 'Overlapping watch addresses produce one alert');
assert.equal(advanceMonitor(settings, null, [report], detected.state).fresh.length, 0, 'Repeated polls do not re-alert');
const renamed = model.normalizeSettings({ ...settings, watches: [first, { ...second, label: 'Work' }], activeWatchId: first.id });
assert.equal(advanceMonitor(renamed, null, [report], detected.state).fresh.length, 0, 'Viewing or renaming does not reset baselines');
const added = model.normalizeSettings({ ...settings, watches: [...settings.watches, { ...second, id: 'third', label: 'Family' }] });
assert.equal(advanceMonitor(added, null, [report], baseline.state).fresh.length, 1, 'Adding an address does not suppress changes in existing addresses');
const disabled = model.normalizeSettings({ ...settings, watches: settings.watches.map(w => ({ ...w, enabled: false })) });
assert.equal(advanceMonitor(disabled, null, [report], baseline.state).fresh.length, 0);
const escalation = { ...report, category: 'Emergency Warning', severity: 3 };
assert.equal(advanceMonitor(settings, null, [escalation], detected.state).fresh.length, 1);
const trip = {
  start: place, destination: { ...place, name: 'Dubbo', latitude: -32.25, longitude: 148.6 },
  coordinates: [[151.2, -33.86], [148.6, -32.25]], distance: 0, duration: 0, calculatedAt: Date.now(), startedAt: Date.now(),
};
const tripIncident = { ...report, id: 'trip-new', severity: 3, latitude: -33.05, longitude: 149.9 };
const tripStarted = advanceMonitor(settings, trip, [report, tripIncident], detected.state);
assert.equal(JSON.stringify(tripStarted.fresh.map(item => item.id)), JSON.stringify(['trip-new']), 'A new incident is not missed when a trip scope starts');
assert.equal(advanceMonitor(settings, trip, [report, tripIncident], tripStarted.state).fresh.length, 0, 'Repeated trip checks do not re-alert');
const tripEnded = advanceMonitor(settings, null, [report, tripIncident], tripStarted.state);
assert.equal(Object.keys(tripEnded.state.scopes).some(id => id.startsWith('trip:')), false, 'Ending a trip removes its route from active scopes');
const resumedTrip = { ...trip, startedAt: trip.startedAt + 1 };
assert.equal(advanceMonitor(settings, resumedTrip, [report, tripIncident], tripEnded.state).fresh.length, 0, 'Resuming a route does not replay incidents already observed');
const changedRoute = {
  ...trip, startedAt: trip.startedAt + 2,
  destination: { ...place, name: 'Wollongong', latitude: -34.43, longitude: 150.89 },
  coordinates: [[151.2, -33.86], [150.89, -34.43]],
};
const changedRouteIncident = { ...report, id: 'new-on-changed-route', severity: 3, latitude: -34.1, longitude: 151.05 };
const routeChanged = advanceMonitor(settings, changedRoute, [report, tripIncident, changedRouteIncident], tripStarted.state);
assert.equal(JSON.stringify(routeChanged.fresh.map(item => item.id)), JSON.stringify(['new-on-changed-route']), 'A changed route reports new incidents once');
const independentLevels = model.normalizeSettings({ ...settings, homeLevel: 'urgent', tripLevel: 'significant' });
const sensitivityBaseline = advanceMonitor(independentLevels, null, [], null);
const tripLevelOnly = { ...report, id: 'trip-level-only', severity: 2 };
const tripSensitivity = advanceMonitor(independentLevels, trip, [tripLevelOnly], sensitivityBaseline.state);
assert.equal(tripSensitivity.state.scopes['watch:office'].seen.includes('trip-level-only:Watch and Act'), false, 'Trip sensitivity does not lower Home Watch sensitivity');
assert.equal(tripSensitivity.state.scopes[`trip:${trip.startedAt}`].seen.includes('trip-level-only:Watch and Act'), true, 'The independent Trip Watch sensitivity applies on its route');
const road = { source: 'tfnsw', id: 'road-1', title: 'Road closure', body: 'Road closure' };
const homeHazard = { id: 'watch:home:tfnsw', label: 'Home', signature: 'home-1', alerts: [road] };
const familyHazard = { ...homeHazard, id: 'watch:family:tfnsw', label: 'Family' };
const hazardBaseline = advanceHazardMonitor([homeHazard, familyHazard], null);
assert.equal(hazardBaseline.fresh.length, 0, 'Existing hazards establish a baseline instead of alerting on first run');
const newRoad = { ...road, id: 'road-2' };
const both = advanceHazardMonitor([
  { ...homeHazard, alerts: [road, newRoad] }, { ...familyHazard, alerts: [road, newRoad] },
], hazardBaseline.state);
assert.equal(both.fresh.length, 1, 'One incident in overlapping watch zones sends one alert');
assert.equal(both.fresh[0].scopeLabels.length, 2, 'One notification names each affected watch zone');
assert.equal(advanceHazardMonitor([homeHazard, familyHazard], both.state).fresh.length, 0, 'Repeated source polls do not re-alert');
const off = advanceHazardMonitor([{ ...homeHazard, signature: 'home-1:tfnsw:false', alerts: [] }], both.state);
assert.equal(advanceHazardMonitor([{ ...homeHazard, signature: 'home-1:tfnsw:true', alerts: [newRoad] }], off.state).fresh.length, 0, 'Turning a source back on does not replay old hazards');
const tripRoad = { ...road, id: 'trip-road' };
const tripHazard = { id: `trip:${trip.startedAt}:tfnsw`, label: 'Trip Watch route', signature: 'trip-1', alerts: [road, tripRoad] };
const startedHazard = advanceHazardMonitor([homeHazard, tripHazard], hazardBaseline.state);
assert.equal(startedHazard.fresh.length, 1, 'A new route reports an unseen hazard without repeating one seen at home');
assert.equal(startedHazard.fresh[0].id, 'trip-road');
const endedHazard = advanceHazardMonitor([homeHazard], startedHazard.state);
assert.equal(endedHazard.fresh.length, 0, 'Ending a trip does not keep emitting alerts from its inactive route');
const resumedHazard = advanceHazardMonitor([
  homeHazard,
  { ...tripHazard, id: `trip:${trip.startedAt + 1}:tfnsw`, signature: 'trip-2', alerts: [tripRoad, { ...road, id: 'resume-road' }] },
], endedHazard.state);
assert.equal(JSON.stringify(resumedHazard.fresh.map(item => item.id)), JSON.stringify(['resume-road']), 'Resuming a trip does not replay an alert already delivered on the prior route');
console.log('PASS: saved-home migration, named watches, per-source alert selections, trip start/end/change/resume, sensitivity separation, baselines, and RFS escalation.');
