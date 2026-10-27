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
  const now = new Date().toISOString();
  const feeds = {
    fireRatings: { status: 'live', districts: [{ name: 'Greater Sydney Region', today: 'High', tomorrow: 'High', totalFireBan: true }] },
    sources: [
      { id: 'tfnsw', name: 'TfNSW', status: 'live', reports: [
        { id: 'near-road', title: 'Nearby closure', category: 'Changed traffic conditions', location: 'Sydney', latitude: -33.86, longitude: 151.2, severity: 0 },
        { id: 'far-road', title: 'Distant closure', category: 'Changed traffic conditions', location: 'Dubbo', latitude: -32.25, longitude: 148.6, severity: 0 },
      ] },
      { id: 'bom', name: 'BOM', status: 'live', reports: [
        { id: 'nsw-warning', title: 'Severe NSW warning', category: 'Weather warning', location: 'NSW warning feed', latitude: null, longitude: null, severity: 2 },
      ] },
      { id: 'ses', name: 'SES', status: 'live', reports: [
        { id: 'near-ses', title: 'Local evacuation notice', category: 'Emergency Warning', location: 'Sydney', latitude: -33.86, longitude: 151.2, severity: 3 },
        { id: 'unlocated-ses', title: 'Unlocated notice', category: 'Watch and Act', location: 'Area unavailable', latitude: null, longitude: null, severity: 2 },
      ] },
    ],
  };
  const weather = {
    fetchedAt: now,
    sources: ['lightning', 'hail', 'wind', 'rain'].map(id => ({ id, status: 'live', availablePoints: 1 })),
    events: [
      { id: 'near-lightning', kind: 'lightning', latitude: -33.86, longitude: 151.2, polygon: [], description: 'Nearby strike', validFrom: now, validTo: '' },
      { id: 'far-lightning', kind: 'lightning', latitude: -34.3, longitude: 150.9, polygon: [], description: 'Distant strike', validFrom: now, validTo: '' },
      { id: 'near-hail', kind: 'hail', latitude: -33.86, longitude: 151.2, polygon: [], description: 'Nearby hail period', validFrom: now, validTo: new Date(Date.now() + 3600000).toISOString() },
    ],
    samples: [
      { latitude: -33.86, longitude: 151.2, windTime: now, windGustKph: 95, rainTime: now, rainEnd: new Date(Date.now() + 3600000).toISOString(), rainPeakMmH: 25 },
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
  assert.equal(alerts.get('bom').length, 1, 'Ungeocoded BOM warnings are labelled and retained as statewide alerts');
  assert.equal(JSON.stringify(alerts.get('ses').map(alert => alert.id)), JSON.stringify(['near-ses:Emergency Warning']), 'Ungeocoded SES alerts are not guessed to be local');
  assert.match(alerts.get('fireDanger')[0].body, /Total fire ban/);
  assert.equal(JSON.stringify(alerts.get('lightning').map(alert => alert.id)), JSON.stringify(['near-lightning']));
  assert.equal(JSON.stringify(alerts.get('hail').map(alert => alert.id)), JSON.stringify(['near-hail']));
  assert.match(alerts.get('wind')[0].body, /95 km\/h/);
  assert.match(alerts.get('rain')[0].body, /25\.0 mm\/h/);
  const muted = model.normalizeSettings({ ...settings, alertHazards: { ...settings.alertHazards, tfnsw: false } });
  const mutedResult = await collectHazardSnapshots(muted, null);
  assert.equal(mutedResult.snapshots.find(snapshot => snapshot.id === 'watch:home:tfnsw').alerts.length, 0);
  feeds.sources.find(source => source.id === 'tfnsw').status = 'stale';
  const stale = await collectHazardSnapshots(settings, null);
  assert.equal(stale.snapshots.some(snapshot => snapshot.id === 'watch:home:tfnsw'), false, 'Stale feeds do not advance a false all-clear baseline');
  assert.equal(stale.errors.some(error => /TfNSW/.test(error)), true, 'Unavailable selected source is reported to the user');
  console.log('PASS: selected feeds, live source statuses, watch-zone filtering, statewide BOM labelling, unmapped SES exclusion, fire danger, weather events and advisory thresholds.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
