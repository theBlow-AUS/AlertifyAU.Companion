# Alertify.au Companion — TestFlight checklist

**Comparison point:** last recorded App Store publish, 28 October 2026  
**Changes in this test build:** commits from 29–30 October 2026

## What changed

- Added current-location hazard alerts with an adjustable 1–50 km radius, separate from saved watch-zone radii.
- Added first-launch explanation before notification and foreground-location permission prompts; Trip Watch background location remains a separate opt-in.
- Added optional Trip Watch background location configuration and Android's visible location foreground service; iOS/Android background work remains subject to operating-system limits.
- Improved alert matching when a Trip Watch is changed, ended, or replaced, including deduplication across overlapping watch, route, and current-location scopes.
- Expanded checks for route-risk coverage outside major cities and documented coverage limitations.
- Added warning freshness information and excluded old warnings from trip-risk results.
- Added status messaging for stale or unavailable location and hazard-feed checks.
- Updated location and background-use privacy disclosures.

## Group 1 — Home monitoring and alert preferences

1. On a fresh install, read the alert setup explanation. Choose **Not now**. Confirm no OS notification or location prompt appears and that the app still opens normally.
2. Open Settings and enable on-device notifications. Confirm the OS prompt follows the in-app explanation. Deny it, then verify the app reports the permission state and does not claim alerts are active.
3. Grant notifications and foreground location, then enable current-location alerts. Confirm the radius starts within the **1–50 km** range and can be changed at the minimum, midpoint, and maximum.
4. Save two or more named watch addresses with different radii. Change the live-location radius and confirm saved watch radii are unchanged.
5. Choose a known feed and opt it out. Confirm it no longer produces alerts, while still being available for browsing. Re-enable it and confirm old active reports are not replayed as new.
6. Compare Home and Trip sensitivity settings. Changing one must not alter the other.
7. Enable quiet hours across midnight. Confirm local notifications are muted in the chosen window and are not sent later as a catch-up.
8. Deny or revoke location permission, switch location services off, or go offline. Confirm the app shows unavailable/stale status rather than an all-clear; restore permission/connectivity and confirm checks resume.

## Group 2 — Trip Watch and notification reliability

1. Create a Trip Watch, hand off to Google Maps or Waze, return to Alertify, and confirm the saved route estimate and Trip Watch remain available. Alertify must not imply that it sees the navigation app's live route or traffic.
2. With a route active, change the destination or replace the Trip Watch. Confirm a report already seen in the old route does not generate a duplicate solely because the route changed.
3. End a Trip Watch, then start another. Confirm ending the previous trip stops its background location session and does not replay old route alerts in the new one.
4. Opt into background location on the Trip Watch screen. Confirm the separate explanation and OS permission flow, then confirm the active trip status is visible. Decline the permission and verify the trip can still be used without background monitoring.
5. Turn off notifications or current-location alerts in Settings, then re-enable foreground alerts while the Trips screen is still open. Start another trip and verify background location stays off unless the user explicitly opts in again. **This is a known consent edge case that needs confirmation before release.**
6. Let a Trip Watch expire or end it manually. Confirm location updates stop. On Android, check that the Alertify Trip Watch foreground-service notification appears only while the opt-in session is active.
7. Move into and out of the live radius around a known incident. Confirm a new nearby incident alerts on entry, leaving does not itself alert, and re-entry follows the app's deduplication rules.
8. Temporarily lose GPS while an incident is active, then regain a fresh fix inside the radius. Confirm the outage does not erase the prior RFS alert baseline or silently suppress an incident encountered during the outage.
9. Confirm location and check timestamps become stale when checks stop, and recover after reopening the app or restoring permissions.

## Group 3 — Coverage, freshness, and data quality

1. Test routes in metro, regional, and more remote Australian areas. Confirm route-risk results do not silently treat uncovered areas as clear.
2. Test an interstate route. Confirm NSW-only warning feeds are clearly identified as NSW coverage and are not presented as complete coverage for other states.
3. Review a current warning and an old/expired warning. Confirm stale warnings are excluded from trip-risk results and freshness/source status is visible.
4. Where possible, compare source timestamps and status with the official publisher. Report missing, stale, duplicated, or incorrectly located results with the feed, time, and approximate test area.
5. Confirm unlocated or statewide alerts are not represented as verified hazards at the user's current position.
6. Check the privacy page and in-app copy. Confirm they describe location-bearing feed requests and the separate optional background Trip Watch use.

## Group 4 — Native device and release boundaries

1. On physical iPhones and Android devices, test permissions both granted and denied, with the screen locked and Alertify in the background.
2. Repeat with battery saver / Low Power Mode, Background App Refresh disabled, and connectivity interrupted. Record whether checks are delayed, stopped, or resumed; do not interpret a lack of notification as guaranteed coverage.
3. Verify opt-out, force-quit, reboot, permission revocation, Trip Watch end, and trip expiry all stop or disable background location as described.
4. **CarPlay and Android Auto hazard maps are not enabled in this build.** Confirm that testers use the phone app and the supported Google Maps/Waze handoff; do not test or advertise an in-car Alertify map.
5. Check layouts and controls on a smaller phone and a larger phone, especially the live-radius control and permission/status notices.

## Known issue / release gate

There is a consent-state edge case to verify: background Trip Watch opt-in may remain stale in the Trips screen after notifications or current-location alerts are disabled elsewhere. Do not submit the build until a tester confirms the consent cannot silently turn back on, or the implementation is corrected.

Native background delivery and battery use require signed TestFlight/device testing; browser preview and mocked native tests cannot prove them.

## Tester report template

- Test group / device model / OS version:
- App build number:
- Scenario number:
- Expected result:
- Actual result:
- Approximate time and area (avoid posting exact home addresses):
- Screenshot or screen recording:
- Did it recover after restoring permission, location, network, or foregrounding the app?
