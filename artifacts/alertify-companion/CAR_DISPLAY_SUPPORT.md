# Car display support status

## Current status

Alertify.au Companion does not currently provide a CarPlay or Android Auto app.
The Live Map is a phone-side website view; it is not a native car-display
integration. Trip Watch keeps an Alertify route estimate and checks available
hazard feeds on the phone, then hands navigation to Google Maps or Waze.

The displayed route estimate is based on OpenStreetMap data through OSRM. It is
not turn-by-turn navigation, live traffic, or the route currently selected by
Google Maps or Waze. The app does not read those apps' live route or traffic.

## CarPlay gate

Apple requires an approved entitlement for the app category. Navigation apps
are the category that can draw map content in the CarPlay window, using
CarPlay's native navigation scene and templates. The available App Store build
entitlement snapshot does not show a CarPlay capability, and this project has
no native CarPlay scene or entitlement configuration. The workspace cannot
confirm whether the developer account has separately received approval. Do not
claim CarPlay compatibility or submit an in-car map until:

1. Alertify.au requests and receives Apple's navigation entitlement for its
   developer account and App ID.
2. A native CarPlay implementation and provisioning profile are integrated
   into the iOS build and verified in CarPlay Simulator and on compatible
   hardware.
3. The supported release process is confirmed to package and sign those native
   additions with the approved entitlement.

### Build-path check

The current Replit mobile build and publishing guidance confirms support for
standard React Native/Expo builds and App Store Connect submission, but says
custom native code requiring an entitlement or CarPlay scene is not supported
by its managed build toolchain. No separate Xcode/EAS build and signing process
for this app has been confirmed. Therefore, the CarPlay scene is blocked until
the account holder confirms both Apple's entitlement approval and a separate
supported build/signing path that can include the capability and native scene.
Do not add CarPlay configuration to `app.json` or describe this app as
CarPlay-enabled before those gates pass.

The account holder confirmed for this release review that the entitlement has
not been requested and no external native iOS build/signing path is available.
The gates are not met; no CarPlay scene or entitlement has been added.

Apple's entitlement request and navigation integration guides:

- https://developer.apple.com/documentation/carplay/requesting-carplay-entitlements
- https://developer.apple.com/documentation/carplay/integrating-carplay-with-your-navigation-app

Replit mobile build references:

- https://docs.replit.com/features/artifact-types/building-mobile-apps
- https://docs.replit.com/build/mobile-upload-ios

## Android Auto gate

Android Auto navigation apps must implement the Android for Cars navigation
category, its navigation service and permitted navigation templates. This
project has no Android for Cars service or templates. A supported Android Auto
service, build, and distribution path for this app has not been confirmed. Do
not claim Android Auto support or begin a native implementation until the
Android build and distribution path are confirmed.

Android's navigation-app requirements:

- https://developer.android.com/training/cars/apps/navigation

## Supported fallback

Until those gates are met:

- Use Trip Watch on the phone to review its estimated route and available
  nearby/corridor hazard context.
- Hand off the destination to Google Maps or Waze for navigation.
- Treat Alertify hazard and route details as supplemental context, not as
  turn-by-turn directions, an all-clear, or live-traffic information.
- Never use the phone while driving; review information before departure and
  follow official emergency instructions.

## Build-path references

- Replit Native Mobile Apps: https://docs.replit.com/features/artifact-types/building-mobile-apps
- Replit build and launch: https://docs.replit.com/tutorials/build-and-launch-a-mobile-app
