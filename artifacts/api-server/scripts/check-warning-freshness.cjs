const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.join(__dirname, '../src/lib/warning-freshness.ts');
const source = fs.readFileSync(file, 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, Date };
vm.runInNewContext(js, context);

const { assessFreshness, warningFreshnessLimits } = context.exports;
const now = Date.parse('2026-10-30T12:00:00.000Z');

for (const [sourceName, maxAgeMinutes] of Object.entries(warningFreshnessLimits)) {
  const justInside = new Date(now - maxAgeMinutes * 60000 + 1).toISOString();
  const exactlyAtLimit = new Date(now - maxAgeMinutes * 60000).toISOString();
  const justOutside = new Date(now - maxAgeMinutes * 60000 - 1).toISOString();
  assert.equal(assessFreshness(justInside, maxAgeMinutes, now).status, 'current', `${sourceName} is current just inside its limit`);
  assert.equal(assessFreshness(exactlyAtLimit, maxAgeMinutes, now).status, 'current', `${sourceName} is current at its inclusive limit`);
  assert.equal(assessFreshness(justOutside, maxAgeMinutes, now).status, 'stale', `${sourceName} is stale just outside its limit`);
}

assert.equal(assessFreshness(null, 30, now).status, 'unavailable', 'missing timestamps are unavailable');
assert.equal(assessFreshness('not-a-timestamp', 30, now).status, 'unavailable', 'invalid timestamps are unavailable');
assert.equal(assessFreshness(new Date(now + 5 * 60000).toISOString(), 30, now).status, 'current', 'small clock skew is tolerated');
assert.equal(assessFreshness(new Date(now + 5 * 60000 + 1).toISOString(), 30, now).status, 'unavailable', 'future timestamps beyond tolerance are unavailable');

console.log('Warning freshness boundary checks passed.');
