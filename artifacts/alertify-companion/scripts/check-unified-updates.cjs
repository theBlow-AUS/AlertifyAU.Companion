const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const context = { exports: {}, require: name => mocks[name] ?? require(name), Date, Intl, Math, Map, Set, console };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const model = load('lib/model.ts');
const geometry = load('lib/weather-geometry.ts', { './model': model });
const { updateTimestamp, combineUpdates, selectUpdates } = load('lib/unified-updates.ts', { './model': model, './weather-geometry': geometry });
assert.equal(new Date(updateTimestamp('27 Oct 2026 17:46')).toISOString(), '2026-10-27T06:46:00.000Z');
assert.equal(new Date(updateTimestamp('27 Jun 2026 17:46')).toISOString(), '2026-06-27T07:46:00.000Z');
assert.equal(updateTimestamp('not supplied'), null);
assert.equal(updateTimestamp('2026-10-27T10:00:00Z'), Date.parse('2026-10-27T10:00:00Z'));
const now = Date.parse('2026-10-28T00:00:00Z');
const watches = [
  { id: 'home', label: 'Home', place: { latitude: -33.86, longitude: 151.2 }, radius: 5, enabled: true },
  { id: 'farm', label: 'Farm', place: { latitude: -32.93, longitude: 151.78 }, radius: 5, enabled: false },
];
const incident = (id, latitude, longitude, updated = '27 Oct 2026 17:46') => ({
  id, latitude, longitude, updated, title: id, location: 'NSW', council: '', category: 'Advice', description: 'Incident', type: 'Fire', severity: 1,
});
const incidents = [incident('home-fire', -33.86, 151.201), incident('farm-fire', -32.93, 151.78), incident('far-fire', -30, 150), incident('unknown-date', -34, 151, 'Unknown')];
const report = (id, latitude, longitude, updatedAt) => ({ id, latitude, longitude, updatedAt, title: id, category: 'Warning', description: 'Heavy rain', location: 'NSW' });
const feeds = {
  sources: [
    { id: 'tfnsw', name: 'TfNSW', reports: [report('road', -33.86, 151.202, '2026-10-27T23:00:00Z')] },
    { id: 'bom', name: 'BOM', reports: [report('statewide', null, null, '2026-10-27T23:30:00Z')] },
    { id: 'ses', name: 'SES', reports: [report('unmapped', null, null, '')] },
  ],
  fireRatings: { updatedAt: '2026-10-27T22:00:00Z', districts: [{ name: 'Greater Sydney', today: 'High', tomorrow: 'Moderate', totalFireBan: false }] },
};
const weather = {
  fetchedAt: '2026-10-27T23:55:00Z',
  events: [
    { id: 'strike', kind: 'lightning', latitude: -33.86, longitude: 151.2, polygon: [], description: 'Lightning', validFrom: '2026-10-27T23:45:00Z', validTo: '' },
    { id: 'old-strike', kind: 'lightning', latitude: -33.86, longitude: 151.2, polygon: [], description: 'Expired', validFrom: '2026-10-27T00:00:00Z', validTo: '' },
    { id: 'hail', kind: 'hail', latitude: null, longitude: null, polygon: [[[151.19, -33.87], [151.21, -33.87], [151.21, -33.85], [151.19, -33.85], [151.19, -33.87]]], description: 'Hail polygon', validFrom: '2026-10-27T23:45:00Z', validTo: '2026-10-28T01:00:00Z' },
  ],
  samples: [{ latitude: -33.86, longitude: 151.2, windGustKph: 0, windSpeedKph: 0, windTime: '2026-10-27T23:00:00Z', windDirection: 'N', rainPeakMmH: 0, rain60minMm: 0, rainTime: '2026-10-27T23:00:00Z' }],
};
const entries = combineUpdates(incidents, feeds, watches, [weather, weather], [{ watchId: 'home', match: { status: 'matched', district: 'Greater Sydney' } }], now);
assert.equal(new Set(entries.map(e => e.source)).size, 6, 'Combines all incident, warning, rating and weather source groups');
assert.equal(entries.filter(e => e.id === 'weather:lightning:strike').length, 1, 'Deduplicates weather across overlapping point batches');
assert.equal(entries.some(e => e.originalId === 'old-strike'), false);
assert.equal(entries.some(e => /Gusts 0.0/.test(e.category)), true, 'Zero observations are not missing values');
assert.equal(entries.find(e => e.source === 'fireDanger').updatedAt, null, 'A dataset refresh is not ranked as a new fire-danger change');
const near = selectUpdates(entries, watches, 'all', 'home', 'distance', '');
assert.equal(near.some(e => e.originalId === 'farm-fire'), true, 'Browsing includes the second saved zone even when alerting there is paused');
assert.equal(near.some(e => e.originalId === 'statewide' || e.originalId === 'unmapped' || e.originalId === 'far-fire'), false);
assert.equal(near.some(e => e.source === 'fireDanger'), true, 'Near view includes a positively matched fire district');
assert.equal(near.some(e => e.originalId === 'hail'), true, 'Hail polygons can match without a fabricated point distance');
assert.equal(selectUpdates(entries, [watches[0]], 'rfs', 'home', 'distance', '').some(e => e.originalId === 'farm-fire'), false);
assert.equal(selectUpdates(entries, watches, 'all', 'nsw', 'latest', '')[0].originalId, 'strike');
assert.equal(selectUpdates(entries, watches, 'bom', 'nsw', 'latest', 'HEAVY RAIN').length, 1);
assert.equal(selectUpdates(entries, [], 'all', 'home', 'latest', '').length, 0);
assert.equal(selectUpdates(entries, [], 'all', 'nsw', 'latest', '').length, entries.length, 'All NSW does not require a watch');
const distanceSorted = selectUpdates(entries, watches, 'all', 'nsw', 'distance', '');
const firstUnmapped = distanceSorted.findIndex(e => !e.nearest);
assert.equal(distanceSorted.slice(firstUnmapped).every(e => !e.nearest), true, 'Unmapped reports sort after mapped points');
const base = { source: 'rfs', sourceName: 'RFS', category: '', location: '', description: '', longitude: 151.2, title: '' };
const bands = [
  { ...base, id: 'closest', latitude: -33.86, updatedAt: 1 },
  { ...base, id: 'same-band-newer', latitude: -33.87, updatedAt: 5 },
  { ...base, id: 'next-band-newest', latitude: -34, updatedAt: 10 },
];
assert.equal(selectUpdates(bands, [watches[0]], 'all', 'nsw', 'distance', '')[0].id, 'closest');
assert.equal(selectUpdates(bands, [watches[0]], 'all', 'nsw', 'latest', '')[0].id, 'next-band-newest');
assert.equal(selectUpdates(bands, [watches[0]], 'all', 'nsw', 'distanceLatest', '').map(e => e.id).join(','), 'same-band-newer,closest,next-band-newest');
console.log('PASS: all sources, named-zone union, selected-zone filtering, unknown locations/times, weather dedup/expiry, district/polygon matches, search, Sydney dates and all three sort modes.');
