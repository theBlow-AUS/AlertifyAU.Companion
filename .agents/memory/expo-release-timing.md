---
name: Expo package release timing
description: How to handle SDK package updates when the workspace applies a minimum release-age policy.
---

Expo's recommended package versions can be published before the workspace allows installing them. A package-manager rejection due to release age is a policy constraint, not a reason to bypass the minimum-age guard.

**Why:** Expo SDK checks may flag freshly published patch versions that the package firewall intentionally withholds until its release-age window expires.

**How to apply:** Keep the currently installed compatible packages, complete other configuration checks, and report the version mismatch. Revisit the updates after the age window passes.

For urgent security fixes, a reviewed, committed pnpm backport with regression
tests is preferable to adding release-age exceptions. Keep version-only audit
findings visible: a patch does not change the package version that scanners see.

**Why:** The dependency policy must remain intact even when a security release
is newer than the eligibility window; scanner silence is not proof of safety.

**How to apply:** Document the upstream patch source and the condition for
removing the backport. Replace it with an eligible fixed upstream release when
available, rerunning the regression tests rather than ignoring the advisory.
