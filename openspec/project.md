# Project Context — Credit Card Rewards & Benefits Tracker

## Purpose

A single-user credit-card benefits tracker. It answers three questions:

1. **What am I about to lose?** — statement credits with reset windows, and minimum-spend
   requirements (MSRs) with deadlines.
2. **Am I getting my annual fees back?** — per-card and portfolio break-even.
3. **Which card do I use for this?** — earn rates by spending category, and an optimal
   3/5/7-card wallet.

Primary use is **one-handed on an iPhone, at night**. That is the design constraint that
outranks all others: log actions must be single taps, everything actionable lives in the
bottom two-thirds of the screen, and no flow may require two hands or a confirm dialog.

Secondary use is a laptop browser for bulk editing and adding cards.

## Users

One person (Andrew). No accounts, no multi-tenancy, no sharing. "Profiles" exist only to
partition cards into groups (e.g. personal vs. business) — they are a filter, not an
identity boundary.

## Stack

**Client**
- Vite + TypeScript + React 18 (`createRoot`)
- `vite-plugin-singlefile` — source is modules; the build output stays one HTML file
- `vitest` for unit tests
- No CSS framework, no component library, no date library, no state library

**Server**
- FastAPI + `asyncpg` with **raw SQL** (no ORM)
- Postgres in the existing Docker container, database `sovereign_ai`
- Served from the Mac Studio, bound to `127.0.0.1:8101`, fronted by `tailscale serve`

**Removed**
- Firebase (Realtime Database + Auth) is deleted entirely. Its rules were world-writable
  and its config was hardcoded in a public repo.

## Repo layout (target)

```
credit-card-tracker/
├── index.html              # Vite entry (old single-file app lives in git history)
├── vite.config.ts, package.json, tsconfig.json
├── data/cards.json         # extracted catalog — seed-only reference data
├── src/
│   ├── main.tsx, App.tsx
│   ├── engine/    period.ts · msr.ts · breakeven.ts · optimizer.ts
│   ├── state/     schema.ts · store.tsx · actions.ts · selectors.ts
│   ├── storage/   api.ts    # load()/save() shim — debounce, flush, 409, unreachable
│   ├── catalog/   catalog.ts · importer.ts
│   └── ui/        tokens.css · components/ · views/ (Today, Wallet, CardDetail,
│                  CatalogSheet, Insights, Settings)
├── server/        app.py · db.py · state.py · requirements.txt · static/ (deploy target)
├── public/        manifest.webmanifest · icons/
├── tools/         extract_catalog.mjs
├── tests/         period.test.ts · msr.test.ts · selectors.test.ts · importer.test.ts
└── docs/          card-schema.md   # single source of truth for the import schema
```

## Architecture rules

- **Layering is strict.** `engine/` and `state/selectors.ts` are pure functions that know
  nothing about React. `state/store.tsx` knows about React but nothing about HTTP.
  `storage/api.ts` knows about HTTP but nothing about the UI. The UI knows nothing about
  the wire format.
- **One blob, last write wins**, guarded by an optimistic-concurrency check. There are no
  per-entity routes.
- **The catalog is copy-on-add.** Adding a card deep-copies catalog values into user state
  with fresh UUIDs. The app never live-reads the catalog for a card the user already owns,
  because a catalog update would silently overwrite his edits.
- **Reference data vs. user state.** Reference data (`data/cards.json`) is the same for
  every cardholder, goes stale, and gets hand-edited. User state is what he holds, his fee
  dates, what he's redeemed, what he's spent — small, personal, never regenerated.
- **Never invent card data.** A wrong published benefit amount is worse than an absent one.
  Missing fields are `null` and are displayed as unknown, not as zero.

## Conventions

- 2-space indentation; React functional components with hooks, no classes
- Comments only where the WHY is non-obvious (a hidden constraint, a subtle invariant, a
  known-bug workaround). No docstring blocks.
- No premature abstractions; three similar lines beat a premature helper
- Validate only at system boundaries (user input, the import parser, the HTTP layer)
- No feature flags and no backwards-compatibility shims — change the code
- Task tracking is **beads (`bd`)**. No TodoWrite, no markdown TODO lists.

### Mac Studio infrastructure conventions (follow exactly)

| Concern | Convention | Reference |
|---|---|---|
| DB pool | asyncpg pool created in a FastAPI lifespan | `~/projects/house-assistant/auth/db.py`, `app.py` |
| Database | `sovereign_ai` in the existing Postgres container (auto-covered by the nightly `pg_dump`) | — |
| Migrations | `llm-infrastructure/scripts/pg_migrate_YYYYMMDD_<name>.sql`, applied by hand via `docker exec` | existing `pg_migrate_*.sql` files |
| Start script | `llm-infrastructure/scripts/start_<name>.sh`, sources `.env`, `exec`s uvicorn | `start_house_api.sh` |
| Service | launchd agent `~/Library/LaunchAgents/com.llm.<name>.plist` | `com.llm.house-api.plist` |
| Logs | `llm-infrastructure/logs/<name>.log` | — |
| Health | an entry in `llm-infrastructure/scripts/health_check.sh` | — |
| Secrets | `<infra-dir>/.env`, read via the environment. Never in git. | — |

## Deployment

- Service: `127.0.0.1:8101` (loopback only — never `0.0.0.0`)
- Public entry: `tailscale serve --bg --https=8443 http://127.0.0.1:8101`
- App URL: `https://<your-machine>.<your-tailnet>.ts.net:8443/`
- Port 443 is **already taken** by the OpenRouter dashboard. A second HTTPS port is used
  rather than a sub-path, because root-path serving means zero base/scope/manifest
  configuration and the `:8443` disappears behind the home-screen icon.
- The tailnet is the authentication boundary. There is no application-level auth, and that
  assumption breaks the moment the port becomes publicly reachable.

## Constraints and non-goals

**Constraints**
- Client build output must remain a single HTML file
- Installable as a PWA on the iPhone home screen (manifest + iOS meta tags)
- Keep the glassmorphic dark visual identity, but the layout is a full redesign
- Mobile-first: 44px minimum touch targets, 56px for the redemption toggle

**Non-goals** (do not build these; do not let a source document argue you into them)
- No service worker, no offline mode, no local write queue
- No authentication, no accounts, no multi-user
- No bank or card-account connections, no Plaid, no scraping
- No transaction categorization
- No CSV statement normalizer (deferred; do not start unless explicitly asked)
- **No data migration.** Existing localStorage data is test data. There is no v1→v2
  migration, no one-time seed, and no seed-once guard. The server starts empty and cards
  are re-added from the catalog.

## Source documents

- `~/.claude/plans/create-a-plan-to-proud-peacock.md` — the master plan. Its decisions are
  locked and are not re-litigated by this spec.
- `~/Downloads/HANDOFF.md` — the originating requirements. Where it conflicts with the
  master plan, **the master plan wins**; the conflicts are enumerated in
  `changes/rebuild-v3/proposal.md`.
