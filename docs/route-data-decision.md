# Route data decision for trip-risk previews

**Decision date:** 27 October 2026  
**Scope:** Route geometry used to estimate which Alertify incidents and warnings are near a planned trip. This does not select or replace the user's navigation app.

## Recommendation

Use **Mapbox Directions API v5 with the `mapbox/driving-traffic` profile** to produce a preview route polyline. Render that route on a Mapbox map, and evaluate it against Alertify's own incident and warning records. Do not describe Mapbox traffic, Google Maps traffic, or any other provider's data as Waze live traffic.

This is the best fit among the reviewed options because Mapbox explicitly lists Australia for traffic-aware driving ETAs, returns route geometry, documents frequent map-data updates and recent traffic observations, and has a relatively generous request-based free tier. It also avoids the published Google Routes API restriction that route results displayed on a map must be displayed on a Google Map.

The recommendation is for a **preview estimate**, not the route users will necessarily travel. Alertify should show the route provider and when the risk check was run, and should not label a route “safe” or suggest that its hazard list is complete.

## Can Alertify assess hazards along the route?

Yes. The Directions response includes route geometry. Alertify can use that geometry as a spatial query path and find its own incidents and warnings within a product-defined distance of the route. Apply Alertify's own status, timestamp, direction, and location-quality rules when scoring or listing results.

Keep the information sources distinct:

- **Route geometry and traffic-aware ETA:** Mapbox Directions.
- **Incidents and warnings shown by Alertify:** Alertify's own incident and warning sources only.
- **External navigation:** Open Google Maps or Waze separately with the trip's origin, destination, and any user-selected stops. Do not claim the Alertify route or its warning list has been transferred, and do not imply Alertify receives Waze's private live-traffic feed.

Recheck Alertify's own warning data at preview time. If route geometry or warning data is unavailable or stale, say so instead of presenting an unqualified risk score.

### Alertify warning freshness policy

Route-provider traffic age and Alertify warning age are separate checks. The trip assessment uses the warning source's own timestamp; it does not infer fresh Alertify data from a newly calculated route. A timestamp exactly at the limit is current. Older data is stale and excluded from risk matches and on-device trip alerts. Missing, invalid, or more than five minutes future-dated timestamps are unavailable. The API returns `freshness.status`, `ageMinutes`, and `maxAgeMinutes` for feed sources and warning records, using `current`, `stale`, or `unavailable`.

| Alertify source/type | Maximum age | Timestamp used | Trip treatment |
| --- | ---: | --- | --- |
| NSW RFS incidents | 5 minutes | Successful RFS feed fetch time | Current feed can be assessed; stale/unavailable feed cannot establish an all-clear. Individual incident update text is descriptive and is not used as feed freshness. |
| TfNSW Live Hazards | 30 minutes | Feed generation time for source health; each record's last-updated/issued time for matching | Stale records are excluded; unavailable source data is not assessed. |
| BOM NSW warnings | 12 hours | Warning publication time; source generation time for feed health | Current warnings remain statewide notices, not route-near matches. Older or undated warnings are excluded from risk matching. |
| NSW SES HazardWatch | 2 hours | Each record's last-updated/issued time; source generation time for feed health | Stale or undated records are excluded from risk matching. |
| Fire-danger ratings | 24 hours | Alertify feed generation time | Stale/unavailable district ratings are not used to qualify a route. |
| Xweather lightning | 60 minutes per strike; 15 minutes for a source snapshot | Strike `validFrom`; source response observation time | Strikes older than 60 minutes are excluded; stale/unavailable source data is reported separately. |
| Xweather hail threats | Active `validFrom`–`validTo` interval; 15 minutes for a source snapshot | Forecast validity interval and source response observation time | Expired forecast periods and stale/unavailable source data are excluded. |
| Xweather wind | 30 minutes | Wind observation time | Older observations are excluded. |
| Xweather rain | 15 minutes | Rain nowcast observation time | Older observations or expired nowcast windows are excluded. |

The freshness limits are product limits, not guarantees that an upstream agency has refreshed its data within that period. `current` means the timestamp is within the stated limit; it does not mean the feed is complete, the route is safe, or the warning covers a specific location. Partial feeds remain identified as partial. A failed refresh is reported as stale when retained data exists and unavailable otherwise.

## Provider comparison

Prices below are public list-price signals checked on the decision date, not quotes. They are in each provider's published currency and can change by region, account, request fields, and volume.

| Option | Australian route and traffic coverage | Freshness | Usage restrictions and cost signal |
| --- | --- | --- | --- |
| **Mapbox Directions** | Australia is listed for `driving-traffic`; route geometry is returned. | Mapbox says its map data is updated continuously. For traffic-aware routing, Australia is in the supported-country list; live speeds are based on observations from the previous 15 minutes where available, with typical traffic used when live traffic is unavailable. This is not a guarantee of uniform live coverage on every road. | Directions API: first 100,000 monthly requests free; then USD $2 per 1,000 requests for 100,001–500,000, with lower volume rates at higher tiers. Use the route under Mapbox's API and product terms, with required attribution and Mapbox's permitted display/use pattern. Traffic Data as a separate raw dataset is an enterprise-licensed product; it is not required merely to request a traffic-aware Directions route. |
| **Google Routes API** | Country-level route coverage is documented and Australia is supported; traffic-aware routing is available where supported. | Traffic-aware route estimates use Google's traffic model, but the public docs do not promise a uniform road-network refresh interval. | Basic Compute Routes Essentials lists 10,000 free monthly events and USD $5 per 1,000 in the first paid volume tier. Traffic-related request options can change the billable SKU. Routes API results displayed on a map must be shown on a Google Map; most route content also has caching restrictions. That makes it a poor fit if the preview route is to be drawn on a non-Google map. |
| **TomTom Routing API (Orbis Maps)** | TomTom's current market-coverage table lists Australia for route calculation and real-time traffic. | Real-time traffic is offered, but a uniform refresh interval for Australian route requests is not promised in the cited coverage page. | TomTom lists 20,000 free monthly Routing API requests, then usage-based pricing. Use remains subject to TomTom's product license and applicable attribution/display terms. |
| **HERE Routing API v8** | HERE offers routing and time-aware routing; its regional coverage information should be checked for the exact trip area and selected feature. | Traffic-aware routing can incorporate current traffic; public material does not state one refresh guarantee that applies to every Australian road. | HERE's public Base Plan lists 5,000 free monthly Time Aware Routing transactions, then EUR €2.33 per 1,000 from 5,001 to 200,000. This is a capable alternative, but the pricing and regional feature coverage should be rechecked before launch. |
| **OpenStreetMap-based routing (such as openrouteservice or self-hosted OSRM)** | OSM road coverage varies by locality and depends on community mapping. Route quality should be tested on target metro, regional, and remote journeys. | OSM edits are ongoing, but a hosted routing graph updates on its own import schedule. A basic OSM router does not provide a dependable live-traffic feed. | OSM data is reusable under ODbL with attribution and share-alike obligations for derivative databases. Public routing endpoints have service limits; self-hosting avoids per-request vendor charges but adds hosting, map-import, monitoring, and update work. Do not rely on the public demo endpoint as a production SLA. |

## Why not use Google Routes for this preview?

Google Routes is a strong route source, particularly when the app displays results on Google Maps and the later navigation handoff is Google Maps. However, its published policy says route results displayed on a map must be displayed on a Google Map, and it limits caching of route content. A preview that draws provider geometry on another map with Alertify's own warning layer risks a licensing mismatch. Revisit Google only if the display design and license are explicitly compatible.

TomTom and HERE are viable commercial alternatives. They have Australia traffic coverage and their own route data, but their coverage, pricing, and use rights should be assessed against the specific map renderer and warning-overlay design before switching. OpenStreetMap routing is attractive for data control and lower API fees, but it trades that for variable coverage, no standard live traffic, and infrastructure or public-service quota constraints.

## Route matching and safety limits

Google Maps and Waze calculate routes independently. They can choose different roads because of their own road graphs, turn restrictions, traffic observations, incidents, route preferences, and changes made after Alertify calculated its preview. Sending only an origin and destination to either app lets it recalculate; it does **not** preserve Mapbox's route polyline. Even if a destination and stops are carried across, the roads between them can differ.

Therefore:

- Describe the line as an **estimated Alertify preview route** and show its provider.
- State that Google Maps or Waze may choose a different route after handoff.
- Keep Alertify's incident/warning details in Alertify; do not claim they appear in Google Maps or Waze.
- Do not imply Waze traffic access, equivalence with Waze's chosen route, complete hazard coverage, or a safety guarantee.
- Refresh the risk check when the user changes the planned trip or explicitly asks for an updated preview.

## Route coverage verification

**Checked:** 30 October 2026
**Profile tested:** Mapbox Directions API v5, `mapbox/driving-traffic`
**Result:** All 24 representative requests returned route geometry. The checks exercise route availability and Alertify's route-proximity matching; they do not establish uniform live-traffic observations on every road.

| Jurisdiction | Metro example | Regional example | Remote example |
| --- | --- | --- | --- |
| NSW | Sydney–Parramatta · 25.9 km | Orange–Dubbo · 150.4 km | Broken Hill–Silverton · 25.4 km |
| VIC | Melbourne–Geelong · 73.9 km | Bendigo–Ballarat · 119.1 km | Mildura–Ouyen · 103.5 km |
| QLD | Brisbane–Ipswich · 39.8 km | Townsville–Charters Towers · 136.6 km | Cloncurry–Mount Isa · 121.1 km |
| SA | Adelaide–Gawler · 51.9 km | Port Augusta–Whyalla · 76.1 km | Coober Pedy–Glendambo · 255.0 km |
| WA | Perth–Mandurah · 72.4 km | Geraldton–Dongara · 65.1 km | Broome–Derby · 223.2 km |
| TAS | Hobart–Glenorchy · 10.6 km | Launceston–Devonport · 102.1 km | Queenstown–Strahan · 41.1 km |
| NT | Darwin–Palmerston · 21.7 km | Katherine–Mataranka · 105.8 km | Alice Springs–Tennant Creek · 508.2 km |
| ACT | Canberra–Gungahlin · 20.7 km | Canberra–Yass · 66.1 km | Canberra–Cooma · 117.2 km |

The ACT examples include a Canberra-to-Yass regional trip and a Canberra-to-Cooma low-density corridor proxy; the latter is outside the ACT because this set has no remote-area road pair within the Territory. Distances are the Mapbox response values for the checked origin/destination pairs, not surveyed road distances.

The route checks also ran controlled report-reference cases through Alertify's `collectHazardSnapshots` trip matcher for every returned geometry. A synthetic mapped report 1.8 km from the route was included, and a second point was placed at least 6 km away; the first matched the 5 km corridor and the second did not in all 24 cases. These are geometry/matching regression references, **not actual or independently reviewed hazard reports**. No real-world false-positive/false-negative rate was measured.

### Limits found

- This validation is a direct Mapbox API request; the companion's current Trip Watch screen still obtains its estimate from public OSRM/OpenStreetMap. The selected Mapbox profile has not yet been integrated into the shipped route flow.
- Route resolution does not prove that live traffic observations exist for every segment. Mapbox may use typical traffic when live speeds are unavailable, especially away from major roads. This check did not compare observed speeds or ETA accuracy.
- Alertify's non-weather warning feeds are region-limited: the RFS incident feed, TfNSW, NSW BOM warnings, NSW SES HazardWatch, and fire-danger district mapping are NSW-specific. BOM records without mapped locations are treated as statewide NSW notices, not as verified route-near warnings. A returned Mapbox route outside NSW therefore does not mean Alertify has matching official warnings there.
- Weather checks use at most five distance-spaced query points for a route. Wind and rain are point samples, not continuous corridor coverage; lightning and hail matching is subject to upstream query radii and source coverage. Long and remote trips can have meaningful gaps.
- The route geometry and warning list are previews. Google Maps and Waze independently recalculate after handoff and can take different roads. No parity, completeness, or safety guarantee is implied.

Re-run the live checks with `pnpm --filter @workspace/alertify-companion run test:route-coverage:mapbox`. The script requires the `MAPBOX_ACCESS_TOKEN` Replit Secret, does not print or persist its value, and tests the selected Mapbox profile. `test:route-coverage` separately checks the current OSRM endpoint used by the app.

## Source links

- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [Mapbox Directions traffic coverage and behavior](https://docs.mapbox.com/help/dive-deeper/directions/)
- [Mapbox map-data updates](https://docs.mapbox.com/help/dive-deeper/mapbox-data/)
- [Mapbox Traffic Data licensing](https://docs.mapbox.com/data/traffic/guides/)
- [Mapbox pricing](https://www.mapbox.com/pricing/)
- [Mapbox terms of service](https://www.mapbox.com/legal/tos)
- [Google Routes API coverage](https://developers.google.com/maps/documentation/routes/coverage)
- [Google Maps Platform country coverage](https://developers.google.com/maps/coverage)
- [Google Routes API policies and attribution](https://developers.google.com/maps/documentation/routes/policies)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [TomTom Orbis Routing coverage](https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/product-information/market-coverage)
- [TomTom pricing](https://docs.tomtom.com/pricing)
- [HERE Routing API v8](https://docs.here.com/routing/docs/routing-v8-intro)
- [HERE car-routing coverage](https://docs.here.com/routing/docs/routing-v8-car-routing-coverage)
- [HERE traffic coverage](https://docs.here.com/traffic-api/docs/traffic-coverage-information)
- [HERE Base Plan pricing](https://www.here.com/get-started/pricing)
- [OpenStreetMap copyright and ODbL](https://www.openstreetmap.org/copyright/en)
- [openrouteservice terms](https://openrouteservice.org/terms-of-service/)

