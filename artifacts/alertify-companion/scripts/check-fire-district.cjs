const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', '../api-server/src/lib/fire-district-match.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { matchFireDistrict, pointInBoundary, hasValidFireBoundary } = context.exports;
const polygon = (name, west, east, south = -34, north = -33.9) => ({
  properties: { lganame: name.toUpperCase() },
  geometry: { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
});
const ratings = [
  { name: 'North Fire District', councils: ['Alpha'] },
  { name: 'South Fire District', councils: ['Beta'] },
];
const alpha = polygon('Alpha', 151, 151.01), beta = polygon('Beta', 151.01, 151.02);
assert.equal(hasValidFireBoundary(alpha), true);
assert.equal(matchFireDistrict([151.005, -33.95], [alpha, beta], ratings).district, 'North Fire District');
assert.equal(matchFireDistrict([151.01, -33.95], [alpha, beta], ratings).status, 'ambiguous', 'A pin on the district boundary must not be guessed');
assert.equal(matchFireDistrict([151.00995, -33.95], [alpha, beta], ratings).status, 'ambiguous', 'Pins within source-boundary precision must not get a guessed district');
assert.equal(matchFireDistrict([151.03, -33.95], [alpha, beta], ratings).status, 'outside_nsw');
assert.equal(matchFireDistrict([151.005, -33.95], [alpha, beta], []).status, 'unavailable');
assert.match(matchFireDistrict([151.005, -33.95], [polygon('Central Coast', 151, 151.01)], [{ name: 'Greater Sydney Region', councils: [] }]).district, /Greater Sydney Region/, 'Uses Alertify’s LGA fallback map');
const multipolygon = { properties: { lganame: 'Multi' }, geometry: { type: 'MultiPolygon', coordinates: [[[[151, -34], [151.01, -34], [151.01, -33.99], [151, -33.99], [151, -34]]], [[[151.1, -34], [151.11, -34], [151.11, -33.99], [151.1, -33.99], [151.1, -34]]]] } };
assert.equal(pointInBoundary([151.005, -33.995], multipolygon.geometry), true);
assert.equal(pointInBoundary([151.105, -33.995], multipolygon.geometry), true);
assert.equal(pointInBoundary([151.05, -33.995], multipolygon.geometry), false);
const withHole = { type: 'Polygon', coordinates: [
  [[151, -34], [151.02, -34], [151.02, -33.98], [151, -33.98], [151, -34]],
  [[151.005, -33.995], [151.015, -33.995], [151.015, -33.985], [151.005, -33.985], [151.005, -33.995]],
] };
assert.equal(pointInBoundary([151.002, -33.99], withHole), true);
assert.equal(pointInBoundary([151.01, -33.99], withHole), false);
console.log('PASS: Alertify LGA match, district-council lookup, explicit fallbacks, source-boundary ambiguity, outside-NSW, multipolygons and holes.');
