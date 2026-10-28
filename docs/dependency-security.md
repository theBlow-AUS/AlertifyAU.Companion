# Dependency security patches

The workspace uses patched upstream releases for proxy-addr, body-parser, Vite,
source-map-js, brace-expansion, markdown-it, qs, fast-uri and Zod. Zod 4 is also
used by Expo CLI via a workspace override; Orval's schema generator and the form
validation adapters are aligned to this major.

Two dependencies require committed pnpm patches. These are applied and
integrity-checked during installation, including frozen-lockfile installs.
No advisory is ignored and the 24-hour minimum release age remains enabled.

## node-forge: GHSA-86w9-cpqp-85rv

Expo CLI and its certificate signer pin node-forge 1.4.0. Releases 1.4.1 and
1.4.2 were published on 2026-10-27 and were not yet eligible for installation
under the workspace's release-age policy.

The patch backports the canonical DER DigestInfo check from upstream
[v1.4.2/lib/rsa.js](https://github.com/digitalbazaar/forge/blob/v1.4.2/lib/rsa.js).
It rejects extra DigestAlgorithm elements, nonempty NULL parameters and other
noncanonical encodings, while retaining valid signatures with and without NULL
parameters. Both Expo consumers resolve to the patched copy.

Replace this patch with an override to node-forge >=1.4.2 once the release is
eligible, then rerun the security regressions. Version-only audits will continue
to report the underlying 1.4.0 version until that upgrade.

## deepmerge: GHSA-gcqx-w48m-w2h4

There is no upstream release newer than 4.3.1. The patch rejects `__proto__`,
`constructor` and `prototype` keys when copying either target or source objects,
including nested objects and null-prototype targets. Both published runtime
bundles and the source entry receive the same fix. Normal recursive merging,
arrays, symbols and `merge.all` remain supported.

Replace the patch when a reviewed upstream fix is available. Version-only
audits may still flag deepmerge 4.3.1; this is not an ignored advisory.

## Verification

Run `pnpm run test:dependency-security` to exercise the actual installed copies
against malicious merge keys and malformed RSA signatures, plus valid merge and
signature controls. It also checks proxy trust, compressed request handling and
Expo CLI's schema creation with Zod 4. Run `pnpm audit` and the platform
dependency audit separately: their version-only findings cannot detect local
patches and must be interpreted alongside these regression checks.
