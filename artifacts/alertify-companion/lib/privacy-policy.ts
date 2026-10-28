export const privacyPolicy = {
  url: 'https://alertifycompanion.replit.app/privacy/',
  updatedAt: '28 October 2026',
  sections: [
    {
      title: 'Who we are',
      paragraphs: [
        'This policy explains how Alertify.au Companion handles information. The privacy operator is Alertify.au. Contact support@ignisse.app with privacy questions or requests.',
      ],
    },
    {
      title: 'Information stored on your device',
      paragraphs: [
        'The app does not require an account. Saved watch names and locations, alert preferences, notification settings, and your optional navigation preference are stored in the app on your device.',
        'When you start a Trip Watch, its chosen start and destination and the estimated route are stored locally so the app can check that estimate. Trip monitoring stops after 24 hours, but the saved trip record remains on this device until you end it or remove the app data. A small incident-feed cache may remain until refreshed or removed.',
        'Local alert history and settings are not synced to an Alertify account. Phone notifications are scheduled on the device; the app does not register a remote push-notification token.',
      ],
    },
    {
      title: 'Location, address searches and routes',
      paragraphs: [
        'Location permission is used only when you choose a location-based feature, such as checking fire danger at your current location, saving a watch address, or choosing a trip starting point. You can deny permission and search for a place instead.',
        'When you search for an address or place, the search text is sent to OpenStreetMap Nominatim to find matching Australian locations. When you estimate a route, its start and destination coordinates are sent to the public OSRM routing service. These providers receive the requests under their own service terms and privacy practices.',
        'Selected watch-zone coordinates and route sample coordinates are sent to Alertify’s service to match fire-danger districts and request weather checks. Alertify processes those coordinates to return the requested results and does not retain them in location request logs or attach them to an account. Weather requests are relayed through Alertify to Xweather. Request data may be processed briefly in service memory while a response is prepared.',
        'If you choose to open Google Maps or Waze, the selected route locations are passed to that app. Its own privacy policy then applies. Alertify does not receive the other app’s live route or traffic data.',
      ],
    },
    {
      title: 'Feeds and service providers',
      paragraphs: [
        'The app retrieves incident, warning, fire-danger, weather and radar information from Alertify.au and the data holders listed below. These requests can also expose ordinary network information, such as your IP address, to the relevant service provider. The app does not send your saved watch name or full saved address to these providers as part of a location check; it sends coordinates when needed.',
        'The current app uses OpenStreetMap Nominatim for place search, OSRM for route estimates, Alertify.au services for fire-district and hazard-feed requests, Xweather for selected weather checks, RainViewer for radar, and NSW RFS for its major-incident feed. Each provider may process technical request information under its own privacy terms.',
      ],
      links: [
        { label: 'OpenStreetMap Nominatim', url: 'https://nominatim.openstreetmap.org/' },
        { label: 'OSRM routing', url: 'https://project-osrm.org/' },
        { label: 'Xweather', url: 'https://www.xweather.com/' },
        { label: 'RainViewer', url: 'https://www.rainviewer.com/' },
        { label: 'NSW Rural Fire Service', url: 'https://www.rfs.nsw.gov.au/' },
        { label: 'Transport for NSW Live Traffic', url: 'https://www.livetraffic.com/' },
        { label: 'Bureau of Meteorology NSW warnings', url: 'https://www.bom.gov.au/nsw/warnings.shtml' },
        { label: 'NSW State Emergency Service', url: 'https://www.ses.nsw.gov.au/' },
      ],
    },
    {
      title: 'Live Map and website analytics',
      paragraphs: [
        'The Live Map displays Alertify.au inside the app. Live Map visits are included in Alertify.au website analytics. Those analytics may record website-use and traffic measures, including device details, approximate geography, referrers and pages visited. The website and its hosting provider may also receive standard network information such as your IP address.',
      ],
    },
    {
      title: 'How long information is kept',
      paragraphs: [
        'Watch addresses and preferences stay on your device until you delete them, clear the app’s data, or remove the app. You can delete a watch address in the app and end a Trip Watch from its trip screen. Device backups may affect when locally stored information is fully removed.',
        'Alertify does not keep submitted coordinates in location request logs or user profiles. Some service responses are held temporarily in server memory to reduce repeated requests; this is not a saved user location history.',
      ],
    },
    {
      title: 'Your choices and requests',
      paragraphs: [
        'You can deny or revoke location permission in your device settings, choose not to save an address, turn off notification checks, delete saved watch addresses, or end a Trip Watch. For questions or requests about information handled by Alertify, email support@ignisse.app. As the app has no user account, most saved app information is managed directly on your device.',
      ],
    },
    {
      title: 'Ownership and attribution of source material',
      paragraphs: [
        'Incident reports, warnings, ratings, forecasts, radar imagery and other third-party material remain the property and responsibility of their respective data holders. Alertify does not claim ownership of that material. Sources are identified in the app and linked where available; use of source material remains subject to the data holder’s terms.',
      ],
    },
    {
      title: 'Children',
      paragraphs: [
        'Alertify.au Companion is not designed for children under 13, and Alertify does not knowingly collect personal information from children under 13 through the app.',
      ],
    },
    {
      title: 'Changes to this policy',
      paragraphs: [
        'If this policy changes, the updated version will show a new revision date. Continued use after an update means the revised policy applies to future use of the app.',
      ],
    },
  ],
} as const;
