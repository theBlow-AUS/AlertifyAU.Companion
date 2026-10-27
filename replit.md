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

- Route-risk previews use Mapbox Directions geometry, while hazards come from Alertify's own warning data; see [the route-data decision](docs/route-data-decision.md).

## Product

- `artifacts/alertify-companion/` is the native Expo app. Run its managed `artifacts/alertify-companion: expo` workflow.
- Approved visual references remain in `artifacts/mockup-sandbox/src/components/mockups/alertify-mobile/`.
- Public data: NSW RFS major incidents, Open-Meteo weather, Nominatim address search, OSRM driving route estimates. No private Alertify API or Google/Waze traffic feed is connected.
- Preferences, home coordinates and active trip estimates are stored locally using AsyncStorage. No account is required.
- Local notifications check for new incidents or warning-level changes while open; optional native background tasks are best-effort and system-scheduled. This is not a guaranteed emergency alert service or a remote push backend.
- Incident proximity uses reported points, not fire perimeters. All source links, error states, cache ages and route-estimate limitations must remain visible.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
