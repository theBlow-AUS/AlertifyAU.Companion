const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const context = { exports: {}, require: name => mocks[name] ?? require(name), Date, Math, Map, Set, console };
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, context);
  return context.exports;
}

async function run() {
  const model = load('lib/model.ts');
  const state = load('lib/monitor-state.ts', { './model': model });
  const policy = load('lib/location-policy.ts', { './model': model });
  const store = new Map();
  const storage = { getItem: async key => store.get(key) ?? null, setItem: async (key, value) => { store.set(key, value); } };
  const tasks = new Map();
  let locationGranted = true;
  let backgroundGranted = true;
  let running = false;
  let starts = 0;
  let stops = 0;
  let prompts = 0;
  let startOptions;
  const location = {
    Accuracy: { Balanced: 3 }, ActivityType: { AutomotiveNavigation: 1 },
    getForegroundPermissionsAsync: async () => ({ granted: locationGranted }),
    getBackgroundPermissionsAsync: async () => ({ granted: backgroundGranted }),
    requestForegroundPermissionsAsync: async () => { prompts++; return { granted: locationGranted }; },
    requestBackgroundPermissionsAsync: async () => { prompts++; return { granted: backgroundGranted }; },
    hasStartedLocationUpdatesAsync: async () => running,
    startLocationUpdatesAsync: async (_, options) => { starts++; running = true; startOptions = options; },
    stopLocationUpdatesAsync: async () => { stops++; running = false; },
  };
  const locationModule = load('lib/location.ts', { './model': model, 'react-native': { Platform: { OS: 'android' } }, 'expo-location': location });
  await locationModule.syncTripBackgroundLocation(true);
  assert.equal(starts, 1);
  assert.equal(startOptions.showsBackgroundLocationIndicator, true);
  assert.match(startOptions.foregroundService.notificationTitle, /Trip Watch/);
  await locationModule.syncTripBackgroundLocation(true);
  assert.equal(starts, 1, 'Repeated sync does not register duplicate location tasks');
  backgroundGranted = false;
  await assert.rejects(locationModule.syncTripBackgroundLocation(true), /permission/);
  assert.equal(running, false, 'Permission revoked stops the running task');
  assert.equal(stops, 1);
  assert.equal(prompts, 0, 'Lifecycle sync never prompts without a user action');
  await assert.rejects(locationModule.enableTripBackgroundLocation(), /Background location/);
  assert.equal(prompts, 1, 'Explicit trip opt-in requests background permission; already-granted foreground permission is not re-requested');

  let passedPoint;
  let delivered = 0;
  let notificationGranted = true;
  const monitor = load('lib/monitor.ts', {
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'background' } },
    '@react-native-async-storage/async-storage': storage,
    'expo-location': location,
    'expo-notifications': {
      setNotificationHandler: () => {},
      getPermissionsAsync: async () => ({ granted: notificationGranted }),
      scheduleNotificationAsync: async () => { delivered++; },
    },
    'expo-background-task': { BackgroundTaskResult: { Success: 1, Failed: 2 } },
    'expo-task-manager': { isTaskDefined: id => tasks.has(id), defineTask: (id, task) => tasks.set(id, task) },
    './model': model,
    './monitor-state': state,
    './location-policy': policy,
    './location': locationModule,
    './services': { fetchFeed: async () => ({ incidents: [], fetchedAt: Date.now() }) },
    './hazard-monitor': { collectHazardSnapshots: async (_, __, point) => { passedPoint = point; return { snapshots: [], errors: [] }; } },
    './live-location-status': { updateLiveLocationStatus: async patch => { store.set(model.LIVE_LOCATION_STATUS_KEY, JSON.stringify(patch)); } },
  });
  const settings = model.normalizeSettings({
    ...model.defaultSettings, notifications: true, currentLocationAlerts: true,
    tripBackgroundLocation: true, watch: false, watches: [],
  });
  store.set(model.SETTINGS_KEY, JSON.stringify(settings));
  const fix = { timestamp: Date.now(), coords: { latitude: -33.86, longitude: 151.2, accuracy: 20 } };
  await monitor.checkForChanges(fix);
  assert.equal(passedPoint.latitude, fix.coords.latitude);
  assert.equal(delivered, 0, 'Initial nearby check is a baseline');
  locationGranted = false;
  await assert.rejects(monitor.checkForChanges(fix), /permission/);
  assert.equal(passedPoint, null, 'Revoked permission prevents using even a fresh cached coordinate');
  assert.match(JSON.parse(store.get(model.LIVE_LOCATION_STATUS_KEY)).error, /permission/);
  locationGranted = true;
  await assert.rejects(monitor.checkForChanges({ ...fix, timestamp: Date.now() - 120001 }), /fresh/);
  assert.equal(passedPoint, null, 'Stale background locations do not become nearby matches');
  notificationGranted = false;
  await assert.rejects(monitor.checkForChanges(fix), /Notifications are blocked/);
  notificationGranted = true;
  const task = tasks.get(model.TRIP_LOCATION_TASK);
  assert.equal(typeof task, 'function', 'Background task is registered at module scope');
  running = true;
  store.set(model.TRIP_KEY, JSON.stringify({ startedAt: Date.now() - 86400001, coordinates: [] }));
  await task({ data: { locations: [fix] } });
  assert.equal(running, false, 'Expired Trip Watch stops native updates in the background handler');
  for (const flag of ['notifications', 'currentLocationAlerts', 'tripBackgroundLocation']) {
    running = true;
    store.set(model.TRIP_KEY, JSON.stringify({ startedAt: Date.now(), coordinates: [] }));
    store.set(model.SETTINGS_KEY, JSON.stringify({ ...settings, [flag]: false }));
    await task({ data: { locations: [fix] } });
    assert.equal(running, false, `${flag} disabled stops the native background task`);
  }
  await task({ error: new Error('OS failure') });
  assert.match(JSON.parse(store.get(model.LIVE_LOCATION_STATUS_KEY)).error, /operating system/);
  assert.equal([...store.values()].some(value => value.includes('"latitude"')), false, 'Monitor status and baselines do not retain raw coordinates');
  console.log('PASS: native permission denial/revocation, stale fix rejection, visible Android service, idempotent start, task expiry/opt-out cleanup and coordinate-free monitor storage (mocked native APIs).');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
