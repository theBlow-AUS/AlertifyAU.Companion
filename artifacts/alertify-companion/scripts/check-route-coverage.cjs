const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const routes = [
  { state: 'NSW', area: 'metro', name: 'Sydney–Parramatta', start: [-33.8688, 151.2093], end: [-33.8150, 151.0010] },
  { state: 'NSW', area: 'regional', name: 'Orange–Dubbo', start: [-33.2830, 149.1000], end: [-32.2569, 148.6011] },
  { state: 'NSW', area: 'remote', name: 'Broken Hill–Silverton', start: [-31.9567, 141.4670], end: [-31.8870, 141.2280] },
  { state: 'VIC', area: 'metro', name: 'Melbourne–Geelong', start: [-37.8136, 144.9631], end: [-38.1499, 144.3617] },
  { state: 'VIC', area: 'regional', name: 'Bendigo–Ballarat', start: [-36.7570, 144.2790], end: [-37.5620, 143.8500] },
  { state: 'VIC', area: 'remote', name: 'Mildura–Ouyen', start: [-34.1850, 142.1620], end: [-35.0700, 142.3210] },
  { state: 'QLD', area: 'metro', name: 'Brisbane–Ipswich', start: [-27.4698, 153.0251], end: [-27.6140, 152.7600] },
  { state: 'QLD', area: 'regional', name: 'Townsville–Charters Towers', start: [-19.2589, 146.8169], end: [-20.0767, 146.2635] },
  { state: 'QLD', area: 'remote', name: 'Cloncurry–Mount Isa', start: [-20.7070, 140.5060], end: [-20.7256, 139.4927] },
  { state: 'SA', area: 'metro', name: 'Adelaide–Gawler', start: [-34.9285, 138.6007], end: [-34.6020, 138.7490] },
  { state: 'SA', area: 'regional', name: 'Port Augusta–Whyalla', start: [-32.4925, 137.7650], end: [-33.0327, 137.5640] },
  { state: 'SA', area: 'remote', name: 'Coober Pedy–Glendambo', start: [-29.0130, 134.7550], end: [-30.9700, 135.7500] },
  { state: 'WA', area: 'metro', name: 'Perth–Mandurah', start: [-31.9505, 115.8605], end: [-32.5269, 115.7217] },
  { state: 'WA', area: 'regional', name: 'Geraldton–Dongara', start: [-28.7780, 114.6140], end: [-29.2510, 114.9320] },
  { state: 'WA', area: 'remote', name: 'Broome–Derby', start: [-17.9614, 122.2360], end: [-17.3020, 123.6280] },
  { state: 'TAS', area: 'metro', name: 'Hobart–Glenorchy', start: [-42.8821, 147.3272], end: [-42.8333, 147.2667] },
  { state: 'TAS', area: 'regional', name: 'Launceston–Devonport', start: [-41.4332, 147.1448], end: [-41.1780, 146.3510] },
  { state: 'TAS', area: 'remote', name: 'Queenstown–Strahan', start: [-42.0800, 145.5560], end: [-42.1520, 145.3290] },
  { state: 'NT', area: 'metro', name: 'Darwin–Palmerston', start: [-12.4634, 130.8456], end: [-12.4860, 130.9830] },
  { state: 'NT', area: 'regional', name: 'Katherine–Mataranka', start: [-14.4650, 132.2630], end: [-14.9210, 133.0640] },
  { state: 'NT', area: 'remote', name: 'Alice Springs–Tennant Creek', start: [-23.6980, 133.8800], end: [-19.6540, 134.1890] },
  { state: 'ACT', area: 'metro', name: 'Canberra–Gungahlin', start: [-35.2809, 149.1300], end: [-35.1867, 149.1360] },
  { state: 'ACT', area: 'regional', name: 'Canberra–Yass', start: [-35.2809, 149.1300], end: [-34.8400, 148.9100] },
  { state: 'ACT', area: 'remote', name: 'Canberra–Cooma', start: [-35.2809, 149.1300], end: [-36.2350, 149.1250] },
];
const useMapbox = process.argv.includes('--mapbox');

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {}, require: name => mocks[name] ?? require(name),
    Date, Math, Map, Set, console,
  };
  vm.runInNewContext(js, context);
  return context.exports;
}

function pointAtOffset(coordinates, offsetMetres, model, minimumRouteDistanceKm = 0) {
  const fractions = [0.2, 0.35, 0.5, 0.65, 0.8];
  const offsets = minimumRouteDistanceKm ? [1, 1.5, 2, 3, 4, 5, 7] : [1];
  for (const fraction of fractions) {
    const segmentIndex = Math.max(1, Math.min(coordinates.length - 1, Math.floor(coordinates.length * fraction)));
    const a = coordinates[segmentIndex - 1];
    const b = coordinates[segmentIndex];
    const latitude = (a[1] + b[1]) / 2;
    const longitudeScale = Math.cos(latitude * Math.PI / 180);
    const dx = (b[0] - a[0]) * longitudeScale;
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    for (const scale of offsets) for (const side of [1, -1]) {
      const metres = offsetMetres * scale;
      const candidate = {
        latitude: latitude + side * (dx / length) * metres / 111320,
        longitude: (a[0] + b[0]) / 2 - side * (dy / length) * metres / (111320 * longitudeScale),
      };
      if (!minimumRouteDistanceKm || model.routeDistance(candidate, coordinates) >= minimumRouteDistanceKm) return candidate;
    }
  }
  throw new Error(`Could not place a reference point at least ${minimumRouteDistanceKm} km from the route`);
}

async function getRoute(test) {
  const waypoints = [test.start, test.end]
    .map(([latitude, longitude]) => `${longitude},${latitude}`).join(';');
  let url;
  let response;
  if (useMapbox) {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) throw new Error('MAPBOX_ACCESS_TOKEN is not available to this test process');
    url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${waypoints}?overview=full&geometries=geojson&steps=false&access_token=${encodeURIComponent(token)}`;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    } catch {
      throw new Error('Mapbox Directions request failed before returning a response');
    }
    if (!response.ok) throw new Error(`${test.name}: Mapbox Directions returned HTTP ${response.status}`);
  } else {
    url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=false`;
    response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`${test.name}: OSRM returned HTTP ${response.status}`);
  }
  const body = await response.json();
  const route = body.routes?.[0];
  if (body.code !== 'Ok' || !Array.isArray(route?.geometry?.coordinates) || route.geometry.coordinates.length < 2) {
    throw new Error(`${test.name}: ${useMapbox ? 'Mapbox driving-traffic' : 'OSRM driving'} returned no usable route`);
  }
  const coordinates = route.geometry.coordinates;
  assert.ok(coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)), `${test.name}: route geometry has invalid coordinates`);
  const distanceKm = route.distance / 1000;
  assert.ok(distanceKm > 0, `${test.name}: route distance must be positive`);
  return { coordinates, distanceKm, durationMinutes: route.duration / 60 };
}

async function checkMatching(model, test, route) {
  const near = pointAtOffset(route.coordinates, 1800, model);
  const far = pointAtOffset(route.coordinates, 7500, model, 6);
  const reports = [
    { id: `${test.state}-near`, title: 'Synthetic reference: within corridor', category: 'Road closure', severity: 2, ...near },
    { id: `${test.state}-far`, title: 'Synthetic reference: outside corridor', category: 'Road closure', severity: 2, ...far },
  ];
  const api = {
    getCompanionFeeds: async () => ({
      fireRatings: { status: 'live', districts: [] },
      sources: [{ id: 'tfnsw', name: 'TfNSW', status: 'live', reports }],
    }),
    getCompanionFireDistrict: async () => ({ status: 'outside_nsw' }),
    getCompanionWeather: async () => { throw new Error('Weather is disabled in this test'); },
  };
  const { collectHazardSnapshots } = load('lib/hazard-monitor.ts', {
    '@workspace/api-client-react': api,
    './model': model,
    './weather-geometry': {
      routeSamples: () => [],
      eventInScope: () => false,
    },
  });
  const alertHazards = Object.fromEntries(Object.keys(model.defaultAlertHazards).map(key => [key, key === 'tfnsw']));
  const settings = model.normalizeSettings({
    ...model.defaultSettings, watch: false, watches: [], currentLocationAlerts: false,
    alertHazards,
  });
  const startedAt = Date.now();
  const trip = {
    startedAt, start: { name: 'Start', latitude: test.start[0], longitude: test.start[1] },
    destination: { name: 'End', latitude: test.end[0], longitude: test.end[1] },
    coordinates: route.coordinates, distance: route.distanceKm, duration: route.durationMinutes, calculatedAt: startedAt,
  };
  const result = await collectHazardSnapshots(settings, trip);
  assert.equal(Array.from(result.errors).length, 0, `${test.name}: should complete the selected mapped-report source`);
  const snapshot = result.snapshots.find(item => item.id === `trip:${startedAt}:tfnsw`);
  assert.ok(snapshot, `${test.name}: trip warning snapshot should exist`);
  assert.deepEqual(Array.from(snapshot.alerts, alert => alert.id), [`${test.state}-near:Road closure`], `${test.name}: match the near reference and reject the far reference`);
}

async function run() {
  const model = load('lib/model.ts');
  const seen = new Set();
  let failures = 0;
  console.log(useMapbox
    ? 'Live checks use Mapbox Directions API v5 with the mapbox/driving-traffic profile. The token is not printed or persisted.'
    : 'Live checks use the companion’s current public OSRM driving endpoint; they do not exercise Mapbox driving-traffic.');
  console.log(`State/Territory | Area | Route | ${useMapbox ? 'Mapbox km' : 'OSRM km'} | Geometry pts | Reference match`);
  for (let index = 0; index < routes.length; index++) {
    const test = routes[index];
    try {
      const route = await getRoute(test);
      await checkMatching(model, test, route);
      seen.add(`${test.state}:${test.area}`);
      console.log(`${test.state} | ${test.area} | ${test.name} | ${route.distanceKm.toFixed(1)} | ${route.coordinates.length} | near yes, far no`);
    } catch (error) {
      failures++;
      console.error(`FAIL | ${test.state} | ${test.area} | ${test.name} | ${error.message}`);
    }
    if (index < routes.length - 1) await new Promise(resolve => setTimeout(resolve, 1100));
  }
  for (const state of ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']) {
    for (const area of ['metro', 'regional', 'remote']) {
      assert.ok(seen.has(`${state}:${area}`), `missing successful ${area} route in ${state}`);
    }
  }
  assert.equal(failures, 0, `${failures} live route checks failed`);
  console.log(`PASS: ${routes.length} routes resolved; all 8 jurisdictions have metro, regional and remote examples; controlled near/far report matching passed.`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
