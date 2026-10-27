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
console.log('PASS: saved-home migration, named watches, per-source alert selections, overlapping scopes, baselines, quiet polling and RFS escalation.');
