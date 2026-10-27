# Alertify.au Companion

Native Expo companion for watching a saved home area, viewing NSW RFS incidents and handing trips off to Google Maps or Waze.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Mapbox Directions is the selected production route provider; see [the route-data decision](docs/route-data-decision.md). The native app currently still uses explicitly labelled public OSRM estimates pending that integration.

## Product

- `artifacts/alertify-companion/` is the native Expo app. Run its managed `artifacts/alertify-companion: expo` workflow.
- Approved visual references remain in `artifacts/mockup-sandbox/src/components/mockups/alertify-mobile/`.
- Public data: NSW RFS major incidents, Open-Meteo weather, Nominatim search, OSRM estimates. `/api/companion/feeds` proxies fixed public Alertify endpoints for fire ratings, TfNSW hazards, BOM warnings and SES HazardWatch, preserving per-source failures and staleness. SES may be unavailable upstream; never interpret that as zero warnings.
- Multiple named watch addresses, independent radii/enabled states and preferences are local AsyncStorage data. Legacy single-home settings migrate without deleting the original home or changing alert levels.
- Fire danger ratings, tomorrow's rating and total fire bans display in-app. Each saved pin is matched against Alertify's NSW LGA boundaries and current council-to-fire-district mapping; boundary ambiguity, unmapped councils and non-NSW locations never get a guessed rating.
- Alert source switches cover RFS, fire danger, TfNSW, BOM, SES and Xweather lightning/hail/wind/rain, with independent watch-zone baselines and overlap deduplication. Unlocated TfNSW/SES reports cannot alert locally; BOM is explicitly NSW-wide. Source browsers remain available when alerting is off. Optional native background checks are best-effort; no guaranteed emergency alerts or remote push backend.
- Incident proximity uses reported points, not fire perimeters. All source links, error states, cache ages and route-estimate limitations must remain visible.
- `/api/companion/weather?points=lat,lon;...` supports up to five validated points. It reuses Alertify's public Xweather proxy for lightning, hail polygons, conditions and rain nowcasts, and RainViewer metadata for animated in-app radar. Requests are cached and concurrency/queue bounded; no Xweather credential is exposed.
- Weather & radar is available per named watch zone and in route-estimate results. Lightning is distance-filtered and hail uses polygon/buffer intersection, including holes. Wind/rain are distance-spaced point samples, not continuous route coverage or arrival-time forecasts. Selected weather sources can send local notifications; wind/rain use advisory thresholds of 90 km/h gusts and 20 mm/hour respectively. Radar is display-only; weather does not reroute navigation.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
