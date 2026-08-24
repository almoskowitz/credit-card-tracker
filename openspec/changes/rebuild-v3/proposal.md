# Proposal — Rebuild v3: merge the benefits tracker, move state to a service

## Why

**Two apps track the same entity.** This repo holds a single-file React card tracker
(earn rates, a benefits HUD, an optimizer, a 24-card database). A second app tracks
statement credits with reset windows, annual-fee break-even, and bonus-category caps.
They overlap on one thing: the card. Maintaining two copies of the card list is the
problem this change exists to kill.

**localStorage cannot be the store any more.** It is scoped per browser, per device.
Serving one app from one host does not give one dataset — phone, laptop, and desktop each
load identical code and then write to three buckets that silently diverge. Hosting solves
code distribution; state has to move to the server separately.

**Firebase has to go.** The recently added Firebase Realtime Database sync has
world-writable rules and its config is hardcoded in a public repo. It is removed entirely
rather than secured, because a self-hosted service on the Mac Studio behind the tailnet is
both simpler and already the house pattern.

**The period logic is wrong in ways that matter.** Today's logic is calendar-only, so
fee-year-anchored credits cannot be modelled at all. The obvious implementation has two
defects: `new Date(2026, 1, 31)` silently becomes March 3, so any card with a fee date on
the 29th–31st computes wrong windows in short months; and `(end - now) / 86400000` returns
23- or 25-hour days across a DST boundary, so "days left" is off by one exactly when it
matters. Both need clamping and whole-calendar-day counting, with tests.

**Minimum-spend requirements are untracked.** For a churner this is the highest-stakes
deadline in the wallet — missing a $1,000 signup bonus dwarfs any statement credit.

**And the app has to be one he'll actually use**: phone-first, one-handed, at night, with
adding a new card or benefit being trivially easy.

## What changes

Six phases, each gated before the next begins.

1. **Catalog extraction & scaffold** — `tools/extract_catalog.mjs` mechanically extracts
   the 32,100-character card database from `index.html:749` into `data/cards.json` before
   the file is replaced: collapsing the monthly explosion, normalizing polymorphic values,
   mapping free-text multiplier categories onto an explicit taxonomy, and converting dead
   `spendBenefits` into MSR seed data. Then the Vite + TypeScript + React 18 +
   `vite-plugin-singlefile` + `vitest` scaffold.
2. **Period engine, tests first** — `period.ts`, `msr.ts`, `breakeven.ts`, `optimizer.ts`
   as pure functions with no date library. Eleven period test cases written red before any
   implementation. Zero UI in this phase.
3. **State schema, server, storage shim** — the v2 state blob; a FastAPI + asyncpg service
   with `GET`/`PUT /api/state` and optimistic concurrency; and a client shim with
   debounced writes, keepalive flush on backgrounding, 409 recovery, and an explicit
   unreachable state that blocks mutations at the reducer boundary.
4. **UI, full redesign, mobile-first** — four bottom tabs (Today · Wallet · Insights ·
   Settings) over a new token system. Today is the runway: MSRs above everything sorted by
   risk, then credits grouped by urgency, each with a 56px one-tap toggle.
5. **Import flow, PWA, deploy** — one documented schema with three import tiers, a web app
   manifest and iOS meta tags, and deployment under launchd behind
   `tailscale serve --https=8443`.
6. **Docs** — README, CLAUDE.md, and AGENTS.md rewritten; the Firebase-era docs deleted.

## Impact

### Added

- `data/cards.json` — extracted catalog (24 cards, 52 benefit definitions)
- `tools/extract_catalog.mjs` — one-shot extraction with invariant checks
- `src/` — engine, state, storage, catalog, and UI modules
- `server/` — FastAPI service and its static deploy target
- `public/` — web app manifest and icons
- `tests/` — `period.test.ts`, `msr.test.ts`, `selectors.test.ts`, `importer.test.ts`
- `docs/card-schema.md` — the single source of truth for the import schema
- `llm-infrastructure/scripts/pg_migrate_20260824_card_tracker.sql`
- `llm-infrastructure/scripts/start_card_tracker.sh`
- `~/Library/LaunchAgents/com.llm.card-tracker.plist`
- Build tooling: `vite.config.ts`, `package.json`, `tsconfig.json`

### Replaced

- `index.html` — becomes the Vite entry point. The current 136 KB single-file app remains
  available in git history, and the catalog is extracted from it **before** it is replaced.
- `README.md`, `CLAUDE.md`, `AGENTS.md`

### Deleted

- All Firebase code, config, and the hardcoded credentials at `index.html:733-745`
- `FEATURES.md`, `FEATURES_DETAILED.md`, `INSTALLATION.md`, `QUICKSTART.md`,
  `USER_GUIDE.md`, `CHANGELOG.md`, `docs/plans/`

### Behaviour changes visible to the user

- Data lives on the server. A phone edit shows on the laptop after a refresh.
- With the service down, the app says so and refuses writes rather than accepting them
  into a local bucket that will later diverge.
- Redemptions record **amounts**, not booleans. One tap logs the full period value;
  partial amounts are edited in the card detail sheet.
- Benefits get stable UUIDs. Today's index-based redemption keys break whenever a benefit
  list is edited.

## Explicitly rejected

These appear in the source documents and are **not** being built. They are listed so they
are not resurrected from `HANDOFF.md` during implementation.

| Rejected | Source | Why |
|---|---|---|
| v1 → v2 data migration | HANDOFF §3 ("migration is required, not optional") | Master plan decision #4: the existing data is test data. The server starts fresh and cards are re-added from the catalog. |
| One-time seed + seed-once guard on the server | HANDOFF §3 | Nothing to seed. Without a migration there is no stale v1 blob to protect against. |
| Automatic pre-migration JSON export | HANDOFF §3 | No migration runs. Manual export still ships as the escape hatch. |
| "No framework, no bundler" | HANDOFF §Constraints | Master plan decision #2. HANDOFF's own escape clause applies: "if it clears roughly 2,000 lines and modularization becomes necessary, use Vite plus `vite-plugin-singlefile`". The output is still one file. |
| "Do not restyle the existing app" | HANDOFF §Constraints | Master plan decision #3: full redesign, mobile-first, keeping the glassmorphic dark identity. The existing layout is not one-handed usable. |
| Service worker / offline caching | both | Non-goal. Offline writes recreate the divergence problem the state service exists to prevent. |
| Application-level auth | both | The tailnet is the boundary. |
| CSV statement normalizer | HANDOFF §Phase 6 | Deferred. Do not start unless asked. |

## Risks

1. **Anniversary period math.** The handoff's own reference sketch is wrong for day-31
   anniversaries in short months — it compares `now.getDate()` against the raw anniversary
   day rather than the clamped one. *Mitigation:* tests written red first, with a case
   targeting exactly that edge, and a corrected algorithm in `design.md`.
2. **iOS write loss on backgrounding.** Backgrounding Safari can freeze a pending debounce
   timer, which is the most likely source of "it didn't save". *Mitigation:* `flush()` on
   `visibilitychange(hidden)` and `pagehide` using `fetch(..., {keepalive: true})`, plus a
   re-GET on foreground. Tested by backgrounding mid-edit on a real phone.
3. **Silent corruption in the catalog collapse.** Collapsing 283 exploded rows into 52
   definitions could quietly drop or alter values. *Mitigation:* a per-card annual-value
   sum invariant that must match exactly pre- and post-collapse, un-collapsible groups
   emitted verbatim with a stderr report, and a human diff review before the file is
   committed.
4. **Period-key format churn.** `periodKey` is the redemption ledger key. Once a format
   ships, changing it orphans history. *Mitigation:* the formats are fixed in `design.md`
   and pinned by a key-stability snapshot test.

## Success criteria

The change is done when all of the following hold (this is the handoff acceptance list
minus the two migration items):

- The app installs to the iPhone home screen and launches standalone over the tailnet
- An edit made on the phone is visible on the laptop after a refresh, and the reverse
- A tab left open with stale state gets a 409 and refreshes instead of clobbering
- Killing the service produces an explicit unreachable state with mutations disabled, not
  a silent local write
- Adding a card from the catalog seeds its benefits, and editing them does not write back
  to `data/cards.json`
- A fee-year-anchored quarterly credit on a card with a Jan 31 fee date computes correct
  windows for all four quarters
- Export produces a file that import restores to an identical state
- A fresh clone can build and deploy from the README alone
