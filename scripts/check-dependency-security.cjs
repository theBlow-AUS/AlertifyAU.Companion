// Exercise the actual resolved dependencies, including pnpm's security patches.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const { gzipSync } = require("node:zlib");

const appRequire = createRequire(path.resolve("artifacts/alertify-companion/package.json"));
const apiRequire = createRequire(path.resolve("artifacts/api-server/package.json"));
const expoRequire = createRequire(appRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const configRequire = createRequire(expoRequire.resolve("@expo/config/package.json"));
const expressRequire = createRequire(apiRequire.resolve("express/package.json"));

function checkDeepmerge() {
  const merge = configRequire("deepmerge");
  const packageDir = path.dirname(configRequire.resolve("deepmerge/package.json"));
  for (const entry of [merge, require(path.join(packageDir, "dist/umd.js"))]) {
    const poisoned = JSON.parse('{"__proto__":{"injected":true},"constructor":{"prototype":{"injected":true}},"prototype":{"injected":true},"safe":{"value":1}}');
    // Previously an own __proto__ on the target, or a null-prototype target,
    // bypassed the inherited-property check and changed the result's prototype.
    for (const target of [{}, Object.create(null), poisoned]) {
      for (const options of [{}, { clone: false }]) {
        const result = entry(target, poisoned, options);
        assert.equal(Object.getPrototypeOf(result), Object.prototype);
        assert.equal(result.injected, undefined);
        for (const key of ["__proto__", "constructor", "prototype"]) {
          assert.equal(Object.hasOwn(result, key), false);
        }
        assert.deepEqual(result.safe, { value: 1 });
      }
    }
    const symbol = Symbol("config");
    assert.deepEqual(entry({ a: { b: 1 }, list: [1] }, { a: { c: 2 }, list: [2], [symbol]: 3 }),
      { a: { b: 1, c: 2 }, list: [1, 2], [symbol]: 3 });
    assert.deepEqual(entry.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  }
  assert.equal({}.injected, undefined);
}

function checkForge() {
  const forge = cliRequire("node-forge");
  const signingRequire = createRequire(cliRequire.resolve("@expo/code-signing-certificates/package.json"));
  assert.equal(signingRequire.resolve("node-forge"), cliRequire.resolve("node-forge"));
  const { asn1 } = forge;
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
  const md = forge.md.sha256.create().update("security regression");
  const digest = md.digest().getBytes();
  assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(md)), true);
  function digestInfo(parameters) {
    return asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes()),
        ...parameters,
      ]),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest),
    ])).getBytes();
  }
  const nullParameter = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "");
  // Valid DigestInfo accepts both standard forms, with and without NULL.
  for (const params of [[], [nullParameter]]) {
    assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(digestInfo(params), "NONE")), true);
  }
  for (const params of [
    [nullParameter, asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "garbage")],
    [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "garbage")],
  ]) {
    const signature = keys.privateKey.sign(digestInfo(params), "NONE");
    assert.throws(() => keys.publicKey.verify(digest, signature), /DigestInfo/);
  }
}

async function checkExpress() {
  const proxyaddr = expressRequire("proxy-addr");
  const req = { socket: { remoteAddress: "203.0.113.10" }, headers: { "x-forwarded-for": "192.0.2.1" } };
  assert.equal(proxyaddr(req, proxyaddr.compile("::ffff:10.0.0.0/8")), "203.0.113.10");
  const trust = proxyaddr.compile("::ffff:10.0.0.0/104");
  assert.equal(trust("10.1.2.3"), true);
  assert.equal(trust("203.0.113.10"), false);
  const app = apiRequire("express")();
  app.use(apiRequire("express").json());
  app.post("/", (req, res) => res.json(req.body));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.type }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const headers = { "Content-Type": "application/json", "Content-Encoding": "gzip" };
    const body = gzipSync('{"ok":true}');
    const normal = await fetch(url, { method: "POST", headers, body });
    assert.deepEqual(await normal.json(), { ok: true });
    await fetch(url, { method: "POST", headers, body: Buffer.concat([body, Buffer.from("trailing garbage")]) });
    // Let decompression stream errors surface, then prove the server survived.
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await fetch(url, { method: "POST", headers, body })).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function main() {
  checkDeepmerge();
  checkForge();
  const zod = appRequire("zod");
  assert.match(appRequire("zod/package.json").version, /^4\./);
  assert.equal(zod.array(zod.number()).max(2).safeParse([1, 2, 3]).success, false);
  assert.equal(cliRequire.resolve("zod"), appRequire.resolve("zod"));
  const { createMCPDevToolsExtensionSchema } = cliRequire("./build/src/start/server/createMCPDevToolsExtensionSchema.js");
  const schema = createMCPDevToolsExtensionSchema({
    packageName: "security-test",
    cliExtensions: { commands: [{ name: "test", title: "Test", parameters: [{ name: "count", type: "number" }] }] },
  });
  assert.equal(schema.safeParse({ command: "test", count: 1 }).success, true);
  assert.equal(schema.safeParse({ command: "test", count: "invalid" }).success, false);
  await checkExpress();
  console.log("Dependency security regressions passed (deepmerge, RSA, proxy trust, compressed bodies, Zod and Expo schema compatibility).");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
