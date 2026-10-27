---
name: Expo package release timing
description: How to handle SDK package updates when the workspace applies a minimum release-age policy.
---

Expo's recommended package versions can be published before the workspace allows installing them. A package-manager rejection due to release age is a policy constraint, not a reason to bypass the minimum-age guard.

**Why:** Expo SDK checks may flag freshly published patch versions that the package firewall intentionally withholds until its release-age window expires.

**How to apply:** Keep the currently installed compatible packages, complete other configuration checks, and report the version mismatch. Revisit the updates after the age window passes.
