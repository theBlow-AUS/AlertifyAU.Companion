---
name: Trip alert scope history
description: Alert de-duplication behavior when Home Watch and Trip Watch scopes change.
---

Keep alert identity history across trip/watch scope changes so an incident already seen in one scope is not repeated when a trip starts or resumes. A new scope can still notify for an incident that has not been observed before. For source snapshots, distinguish a removed scope from an active scope that reports an alert has cleared: removal preserves history for trip resumption, while a confirmed clear permits a later recrossing to notify again.

**Why:** The user expects new qualifying incidents during a trip without missed alerts or repeats when trips end, change, and resume; persistent suppression must not silence a later hazard crossing.

**How to apply:** When changing local notification state, compare source-qualified event identity across active and recently removed scopes, and only clear global deduplication after a same-signature active scope confirms the event is absent.
