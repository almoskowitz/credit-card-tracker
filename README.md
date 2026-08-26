# Credit Card Rewards Tracker

A single-user credit-card benefits tracker. It answers three questions: what am I about
to lose (statement credits with reset windows, minimum-spend requirements with
deadlines), am I getting my annual fees back (per-card and portfolio break-even), and
which card do I use for this (earn rates by category, optimal 3/5/7-card wallet).

Primary use is one-handed on an iPhone, at night. Secondary use is a laptop browser for
bulk editing and adding cards.

**App URL:** `https://<your-machine>.<your-tailnet>.ts.net:8443/`

## Architecture

A Vite + React + TypeScript client and a FastAPI + Postgres state service, split by a
single rule: **only `src/storage/` may speak to the API.** Everything above it works in
plain data.

```
src/engine/     Pure functions, no React, no dates library — period.ts, msr.ts, breakeven.ts, optimizer.ts
src/state/      schema.ts (State shape), actions.ts + store.tsx (reducer, HTTP-free), selectors.ts
src/storage/    api.ts — the only module that calls fetch('/api/...')
src/catalog/    catalog.ts (copy-on-add), categories.ts, importer.ts (paste/validate a card)
src/ui/         components/ and views/ — Today, Wallet, Insights, Settings
data/cards.json Seed catalog (25 cards) — read only when adding a card to a wallet
server/         FastAPI app: app.py, state.py (GET/PUT /api/state), db.py (asyncpg pool)
tests/          vitest — engine, importer, catalog, and selector tests
docs/card-schema.md   Import format for catalog cards
```

The four tabs:

- **Today** — MSR runway cards and the current-period benefit list, sorted by urgency.
- **Wallet** — cards for the active profile, each with a fee-recovery bar and an
  expandable benefit/MSR/earn-rate/cap detail sheet.
- **Insights** — spend-by-category input, best-card-per-category, and 3/5/7-card wallet
  recommendations.
- **Settings** — profiles, connection status, last-synced time, and adding a card from
  the catalog (search, paste, or blank form).

There is no local data store and no third-party cloud sync of any kind. The client holds
one `State` blob in memory, debounces edits 750ms, and PUTs the whole blob to the server.
The server holds one row. There is no offline queue: an edit made while the server is
unreachable is applied in memory and lost if it can't be flushed before the tab closes.
Per-device view state only (last tab, active profile) lives in `localStorage` under
`card-tracker:view-prefs` — never app data.

## Development

```bash
npm install
```

**Client, against a local server:**

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
DATABASE_URL=postgres://<user>:<pass>@localhost:5432/sovereign_ai .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8101
```

In a second terminal, from the repo root:

```bash
npm run dev
```

`vite.config.ts` proxies `/api` to `127.0.0.1:8101` in dev only — the production build is
served directly by the FastAPI process (see Deploy below), so this proxy has no effect
outside `npm run dev`.

**Commands:**

```bash
npm test                  # vitest run — all suites
npm run validate:catalog  # vitest run tests/catalog.test.ts — validates data/cards.json
npm run build             # vite build -> dist/ (single self-contained HTML file)
npm run deploy            # build, then copy dist/* into server/static/
```

## The state service

FastAPI app in `server/`, bound to `127.0.0.1:8101` only — never `0.0.0.0`. No CORS
middleware (the client is served same-origin), no `/docs` or `/redoc`.

```
GET  /api/health   -> 200 {"ok": true}                       (SELECT 1 against Postgres)
GET  /api/state    -> 200 { updatedAt: string | null, state: State | null }
PUT  /api/state    <- { updatedAt: string | null, state: State }
                   -> 200 { updatedAt: string }
                   -> 409 { updatedAt: string | null, state: State | null }
```

State lives in one row of the `app_state` table in the `sovereign_ai` Postgres database:

```sql
create table app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
```

The row key is the literal string `'card-tracker'`. `PUT` is optimistic-concurrency,
single-statement (`UPDATE ... WHERE key = ... AND updated_at = $1 RETURNING updated_at`),
so there is no read-then-write race:

- Non-null `updatedAt`, row updated → `200` with the new `updatedAt`.
- Non-null `updatedAt`, no row matched → `409` with the server's current
  `{updatedAt, state}` — the caller was stale. The rejected write is never retried; the
  client rolls the optimistic change back to the server's copy.
- Null `updatedAt` (client believes it's the first write), row already exists → `409`.
- Null `updatedAt`, no row yet → `INSERT ... ON CONFLICT DO NOTHING RETURNING updated_at`.

`updatedAt` is an opaque ISO-8601 string end to end — the server serializes it once and
both sides compare it as a string, never parsed back into a date.

Backups: `sovereign_ai` is already covered by the existing nightly `pg_dump`; no
additional backup machinery was added for this table.

## Operations

- **launchd label:** `com.llm.card-tracker`, plist at
  `~/Library/LaunchAgents/com.llm.card-tracker.plist` (`RunAtLoad`, `KeepAlive`).
  Load/reload: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.llm.card-tracker.plist`.
- **Start script:** `llm-infrastructure/scripts/start_card_tracker.sh` sources
  `llm-infrastructure/.env`, builds `DATABASE_URL`, then runs
  `exec .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8101`.
- **Logs:** stdout/stderr both go to `llm-infrastructure/logs/card-tracker.log`.
- **Exposure:** `tailscale serve --bg --https=8443 http://127.0.0.1:8101` — a second HTTPS
  port (443 is already taken on this Mac Studio by another app), root-path served so
  there's no base-href/PWA-scope juggling. App URL:
  `https://<your-machine>.<your-tailnet>.ts.net:8443/`.
- **Health check:** `curl http://127.0.0.1:8101/api/health` should return `{"ok": true}`.
  An entry for this endpoint lives in `llm-infrastructure/scripts/health_check.sh`.
- **Backup coverage:** the nightly `sovereign_ai` `pg_dump` (existing infrastructure,
  nothing card-tracker-specific).

### Deploying a code change

1. **Server change** — edit `server/*.py`, then restart the launchd job:
   `launchctl kickstart -k gui/$(id -u)/com.llm.card-tracker`.
2. **Client change** — `npm run deploy` (build + copy into `server/static/`). This is a
   file copy; no restart needed — `server/static/index.html` is served with
   `Cache-Control: no-cache` specifically so a stale copy is never mistaken for a working
   deploy.
3. **Schema change** — write a new migration file in `llm-infrastructure/scripts/`
   (following the naming of `pg_migrate_20260824_card_tracker.sql`) and apply it by hand:
   `docker exec -i <pg-container> psql -U <user> -d sovereign_ai < path/to/migration.sql`.

## Adding a card

Three ways, all inside the app (Settings → Add Card):

1. **Search** the built-in catalog (`data/cards.json`, 25 cards) and add it to a profile.
2. **Paste** a JSON object matching the catalog schema — validated client-side before
   it's added.
3. **Blank form** for a card not in the catalog.

Adding a card deep-copies it into your state with fresh UUIDs on every entity; the
catalog is never read live again for a card you already own. See
[`docs/card-schema.md`](docs/card-schema.md) for the exact field reference, an annotated
example, and a copy-paste prompt for formatting a benefits page into the schema with an
LLM.

## Acceptance gate

A fresh clone must be able to build and deploy following only this document. Verified by
cloning the repo into a scratch directory and running `npm install && npm run build`
(server setup and `npm run deploy` are the same commands, run against the real server —
not re-verified from a throwaway clone since that would touch the live database).
