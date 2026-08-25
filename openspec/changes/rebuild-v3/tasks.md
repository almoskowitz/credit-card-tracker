# Tasks — Rebuild v3

72 tasks across the 6 phases of the master plan. Each carries a one-line acceptance
criterion and explicit dependencies.

## For the agent generating beads

- Create **6 epics**, one per phase, titled `Phase N — <phase name>`.
- Create **one child issue per numbered task**. The issue title is the task title; the
  description carries the acceptance criterion verbatim plus a pointer to the relevant
  `specs/<capability>/spec.md`.
- For every `depends: X.Y` note, run `bd dep add` so the ordering is enforced. Where a task
  lists several, add each.
- Phase epics depend on the previous phase's epic.
- Verify with `bd ready`. Three tasks carry no task-level prerequisite: **1.1**, **1.9**,
  and **3.4** (the SQL migration file, which genuinely depends on nothing). If the epic
  dependencies gate their children in your beads setup, only 1.1 and 1.9 should be ready;
  if they do not, 3.4 will also appear and that is expected — it can be written at any
  time. Nothing else should be ready.

Notation: `depends: —` means no prerequisite. Sizes are 0.5–2h each.

---

## Phase 1 — Catalog extraction & scaffold

Capability: `catalog`. Gate: 24 cards, 283 rows accounted for, per-card annual sums match
exactly, human-reviewed diff, and `npm run build` emits a single working `dist/index.html`.

- [ ] **1.1 Write the extraction parser skeleton** — `tools/extract_catalog.mjs` reads the
  JSON literal at `index.html:749`, parses it with no npm dependencies, and prints a stats
  report: card count, row count, and rows by frequency.
  *Acceptance:* running it prints `24 cards, 283 rows (216 monthly / 32 quarterly / 18 semi-annual / 17 annual)`.
  (depends: —)

- [ ] **1.2 Implement cadence collapse with valueOverrides** — group by card, base name
  (period suffix stripped), and frequency; collapse complete spans; emit modal value plus
  `valueOverrides` when members differ; emit ill-formed groups un-collapsed with a stderr
  report.
  *Acceptance:* 52 definitions emitted, with `Amex Platinum / Uber Cash` carrying
  `{"M12": 20}` as the only override in the catalog.
  (depends: 1.1)

- [ ] **1.3 Implement polymorphic value normalization** — numeric values become `value`;
  string values become `displayValue` with `value` from `monetaryValue` or `null`.
  *Acceptance:* the five string-valued rows emit `value: null` with their original text
  preserved, and no number is inferred from any of them.
  (depends: 1.1)

- [ ] **1.4 Build and apply the multiplier lookup table** — the explicit 47-key to 14-slug
  table from `design.md` §5.3, with lossy mappings preserving the original text in `notes`
  and unmapped keys falling to `other`.
  *Acceptance:* every emitted `earnRates[].category` is one of the 14 slugs, and no
  substring or fuzzy matching exists in the tool.
  (depends: 1.1)

- [ ] **1.5 Map spendBenefits to spendThresholds** — `{name, spendRequired, yearType}` to
  `{label, requirement, anchor}` with `Membership Year → anniversary` and
  `Calendar Year → calendar`.
  *Acceptance:* 11 thresholds emitted across the same 9 cards; the other 15 have
  `spendThresholds: []`.
  (depends: 1.1)

- [ ] **1.6 Emit data/cards.json in schema v1** — assemble `schemaVersion`, `updated`, the
  14-entry `categories[]`, and `cards[]` with derived slugs, null for absent fields,
  `caps: []`, and `anchor: "calendar"` throughout.
  *Acceptance:* the file parses, contains 24 cards with unique kebab-case slugs, and every
  card has `caps: []`.
  (depends: 1.2, 1.3, 1.4, 1.5)

- [ ] **1.7 Add the extraction invariant gate** — refuse to write unless 24 cards, all 283
  rows accounted for, per-card annual sums identical pre/post collapse, and all enums
  valid; print each check.
  *Acceptance:* the report shows all six checks passing, and deliberately corrupting a
  value makes the tool exit non-zero without writing the file.
  (depends: 1.6)

- [ ] **1.8 Review and commit the extracted catalog** — a human reads the full diff and
  confirms the counts, the single override, and the five null-valued benefits.
  *Acceptance:* `data/cards.json` is committed with the invariant report in the commit
  message.
  (depends: 1.7)

- [ ] **1.9 Scaffold Vite + TypeScript + React 18 + singlefile + vitest** — `package.json`,
  `vite.config.ts` with `vite-plugin-singlefile`, `tsconfig.json`, `src/main.tsx` using
  `createRoot`, and a placeholder `App.tsx`.
  *Acceptance:* `npm run build` emits one `dist/index.html` that opens and renders with no
  external script or stylesheet request.
  (depends: —)

- [ ] **1.10 Add the npm script set** — `dev`, `build`, `test`, `validate:catalog`, and
  `deploy` (build then copy `dist/*` into `server/static/`).
  *Acceptance:* each script runs and does what its name says; `npm test` runs vitest.
  (depends: 1.9)

---

## Phase 2 — Period engine (tests first)

Capability: `period-engine`. Gate: `npx vitest run` green with zero UI written.

- [ ] **2.1 Write tests/period.test.ts red first** — all eleven mandated cases PE-1 to
  PE-11 from `specs/period-engine/spec.md`, plus the no-anniversary and unparseable-
  anniversary fallbacks.
  *Acceptance:* 13 tests exist and all fail because `src/engine/period.ts` has no
  implementation yet.
  (depends: 1.9)

- [ ] **2.2 Implement clampDay and daysLeft** — clamp any day-of-month to the target
  month's last valid day; count days by differencing local calendar dates.
  *Acceptance:* PE-7 and PE-8 pass, and `clampDay` for day 31 across all twelve months of
  2026 returns the expected sequence.
  (depends: 2.1)

- [ ] **2.3 Implement calendar-anchored periodFor** — buckets aligned to January 1, keys in
  `"YYYY-MM"`, start-inclusive and end-exclusive.
  *Acceptance:* PE-4, PE-5, and PE-6 pass.
  (depends: 2.2)

- [ ] **2.4 Implement anniversary-anchored periodFor** — including the corrected
  months-elapsed comparison against the day clamped into the current month, and the
  fallback to calendar when the anniversary is missing or unparseable.
  *Acceptance:* PE-1, PE-2, PE-3, PE-11, and both fallback tests pass.
  (depends: 2.3)

- [ ] **2.5 Implement resolveBenefitValue** — prefer a matching `valueOverrides` entry by
  period suffix, then `value`, propagating `null`.
  *Acceptance:* PE-9 and the PE-10 key snapshot pass.
  (depends: 2.3)

- [ ] **2.6 Implement msr.ts with tests** — remaining, days to deadline, required per week,
  and `atRisk` against the trailing three-month run rate with the no-history fallback.
  *Acceptance:* `tests/msr.test.ts` covers both risk paths, the completed case, and the
  missed case, and passes.
  (depends: 2.2)

- [ ] **2.7 Implement breakeven.ts with tests** — recovery percentage capped at 100, net
  cost floored at 0, potential value expanding recurring benefits across the year.
  *Acceptance:* a zero-fee card produces no `NaN` or `Infinity`, and a monthly $15 benefit
  with a December $20 override yields a potential of 185.
  (depends: 2.5)

- [ ] **2.8 Port optimizer.ts to the taxonomy with tests** — best card per category and
  3/5/7-card wallets, using exact slug lookups with the fuzzy matching from
  `index.html:1153` removed.
  *Acceptance:* spend-weighted and unweighted rankings both produce correct orders, and
  requesting more cards than are owned returns only what exists.
  (depends: 1.6)

- [ ] **2.9 Phase 2 gate** — full engine test run, and confirmation that nothing under
  `src/engine/` imports React, the UI, or the storage layer.
  *Acceptance:* `npx vitest run` is green and the import audit finds no violation.
  (depends: 2.4, 2.5, 2.6, 2.7, 2.8)

---

## Phase 3 — State schema, server, storage shim

Capabilities: `state-schema`, `state-service`, `storage-sync`. Gate: migration applied,
curl round-trip works, a scripted stale PUT returns 409 with the current state, and killing
the server produces the banner with mutations blocked.

- [ ] **3.1 Define the v2 schema and default state** — `src/state/schema.ts` with the
  TypeScript types for all ten collections and a `defaultState()` seeding one profile and
  the 14 categories.
  *Acceptance:* the types compile and `defaultState()` returns `schemaVersion: 2` with
  every other collection empty.
  (depends: 1.9)

- [ ] **3.2 Implement actions and the pure reducer store** — `src/state/actions.ts` and
  `src/state/store.tsx` as React context over `useReducer`, with UUIDs supplied in action
  payloads rather than generated inside the reducer.
  *Acceptance:* the reducer performs no I/O and mutates no input; deleting a card removes
  its benefits, MSRs, earn rates, and redemptions in one action.
  (depends: 3.1)

- [ ] **3.3 Implement selectors with tests** — runway grouping, MSR ordering, per-card and
  portfolio break-even, all filtered by the active profile.
  *Acceptance:* `tests/selectors.test.ts` passes against plain state objects with no
  renderer mounted.
  (depends: 3.2, 2.4)

- [ ] **3.4 Write the SQL migration** —
  `llm-infrastructure/scripts/pg_migrate_20260824_card_tracker.sql` creating `app_state`,
  idempotent on re-application.
  *Acceptance:* the file matches the house `pg_migrate_*` naming and re-running it does not
  error.
  (depends: —)

- [ ] **3.5 Apply the migration to sovereign_ai** — via `docker exec` against the existing
  Postgres container.
  *Acceptance:* `\d app_state` shows the three columns with the primary key and the
  `now()` default.
  (depends: 3.4)

- [ ] **3.6 Implement server/db.py** — asyncpg pool copied from
  `house-assistant/auth/db.py`, reading `DATABASE_URL` from the environment.
  *Acceptance:* the module contains no credential literal and exposes a pool created once.
  (depends: 3.4)

- [ ] **3.7 Implement server/app.py** — FastAPI with lifespan pool wiring, `docs_url=None`,
  `GET /api/health` running `SELECT 1`, and the static mount at `/` registered after the
  API routes with `no-cache` on `index.html`.
  *Acceptance:* health returns 200 with the database up and non-200 with it down; `/docs`
  returns 404; `/api/health` is not shadowed by the static mount.
  (depends: 3.6)

- [ ] **3.8 Implement GET /api/state** — return `{updatedAt, state}`, both `null` when no
  row exists.
  *Acceptance:* `curl` against an empty database returns
  `{"updatedAt": null, "state": null}`.
  (depends: 3.7)

- [ ] **3.9 Implement PUT /api/state with optimistic concurrency** — the single conditional
  UPDATE from `design.md` §3, the 409-with-current-state paths, the INSERT on null, and
  exact-string comparison of `updatedAt`.
  *Acceptance:* the five rows of the dispatch table each produce their documented response
  under curl.
  (depends: 3.8)

- [ ] **3.10 Create the server virtualenv and requirements** — FastAPI, uvicorn, asyncpg;
  no ORM.
  *Acceptance:* `server/.venv/bin/uvicorn server.app:app --port 8101` starts and answers
  health.
  (depends: 3.7)

- [ ] **3.11 Implement the storage shim load and debounced save** — `src/storage/api.ts`
  exposing `load()`, `save()`, and `flush()`, coalescing writes at 750ms.
  *Acceptance:* six keystrokes within two seconds produce exactly one PUT carrying the
  final value.
  (depends: 3.1)

- [ ] **3.12 Implement flush on background and re-GET on foreground** — `visibilitychange`
  and `pagehide` issue the pending write with `keepalive: true`; returning to the
  foreground re-reads state when no write is pending.
  *Acceptance:* backgrounding with a pending edit issues the PUT immediately, and a flush
  with nothing pending sends nothing.
  (depends: 3.11)

- [ ] **3.13 Implement 409 recovery** — replace local state from the response body, adopt
  its `updatedAt`, show the "Refreshed — your view was out of date" toast, and do not retry.
  *Acceptance:* a scripted stale PUT leaves the tab showing the server's state with no
  retry loop and no page reload.
  (depends: 3.11, 3.2)

- [ ] **3.14 Implement the unreachable state** — persistent banner, mutations rejected at
  the reducer boundary, exponential backoff capped at 30s, manual retry, and automatic
  recovery. No local data fallback anywhere.
  *Acceptance:* with the server stopped, every mutation is refused with an explanation
  while navigation still works, and restarting the server clears the banner without a
  reload.
  (depends: 3.13)

- [ ] **3.15 Phase 3 gate** — curl round-trip, scripted stale PUT returning 409 with the
  current state, and a kill-the-server run confirming the banner and blocked mutations.
  *Acceptance:* all three verifications pass and are recorded.
  (depends: 3.9, 3.14)

---

## Phase 4 — UI (full redesign, mobile-first)

Capabilities: `ui-today`, `ui-wallet`, `ui-insights-settings`. Per-view gate: works
one-handed in iOS Safari responsive mode. Phase gate: add card, mark used, survives a
refresh in a second browser.

Every 4.x task depends on 4.1 and 4.2 for tokens and primitives; the explicit `depends:`
lines below record the additional prerequisites.

- [ ] **4.1 Build the token system** — `src/ui/tokens.css` with the palette, glass
  surfaces, semantic accents, carried-over issuer accents, the 28/22/17/15/13 type scale,
  tabular numerals, motion timings, and the reduced-motion block.
  *Acceptance:* the token file holds every colour and size literal in the app, and a
  reduced-motion device plays no transition.
  (depends: 1.9)

- [ ] **4.2 Build the shared primitives** — drag-dismissible `BottomSheet`, `Toast`,
  progress bar and meter, numeric-pad sheet, and the tab bar with safe-area padding.
  *Acceptance:* every primitive meets the 44px minimum, the sheet dismisses by drag, and no
  centered modal exists.
  (depends: 4.1)

- [ ] **4.3 Build the app shell and four tabs** — Today, Wallet, Insights, Settings wired
  to the store, defaulting to Today.
  *Acceptance:* switching tabs preserves scroll position and issues no network request.
  (depends: 4.2, 3.2)

- [ ] **4.4 Build the Today header** — month, connection dot, and profile chip, with no
  primary action.
  *Acceptance:* the only tappable element is the profile chip, and the dot changes when the
  service becomes unreachable.
  (depends: 4.3)

- [ ] **4.5 Build the MSR strip** — above all credits, sorted by risk, with progress bar,
  the `$X left · Y days · $Z/wk needed` line, at-risk edge glow, and tap-to-numeric-pad
  spend logging.
  *Acceptance:* an at-risk MSR sorts above a credit expiring tomorrow and logging spend
  updates progress and pace with no dialog.
  (depends: 4.4, 2.6)

- [ ] **4.6 Build the runway list** — grouped Ending this week / Ending this month / Later
  this period, omitting empty groups, each row showing name, card, resolved value, and days
  left.
  *Acceptance:* benefits ending in 3, 19, and 150 days land in the three groups
  respectively, and a null-valued benefit shows its display text.
  (depends: 4.4, 2.4)

- [ ] **4.7 Build the redemption toggle** — 56px, one tap logs the full resolved value,
  second tap undoes, 5-second toast offering "Edit amount", no confirm dialogs.
  *Acceptance:* tap records the amount under the correct period key, re-tap deletes it, and
  no confirm prompt appears anywhere in the flow.
  (depends: 4.6)

- [ ] **4.8 Build the Done section** — dimmed and collapsed, showing count and total, with
  undo returning a row to its urgency group.
  *Acceptance:* redeeming moves a row into Done, and a new period returns it to an active
  group while the old redemption stays in state.
  (depends: 4.7)

- [ ] **4.9 Build the wallet card list** — issuer accent edge and fee break-even bar, with
  no-fee cards showing value instead, filtered to the active profile.
  *Acceptance:* a $695 card with $400 recovered shows a 57.6% bar and $295 net cost.
  (depends: 4.3, 2.7)

- [ ] **4.10 Build the CardDetail sheet shell** — drag-dismissible, leading with the
  break-even meter, with editing for name, issuer, fee, anniversary, opened, and closed.
  *Acceptance:* setting an anniversary immediately switches anchored benefits to
  `A`-prefixed period keys, and clearing it falls back without throwing.
  (depends: 4.9, 4.2)

- [ ] **4.11 Build benefits CRUD in CardDetail** — create, edit, delete, including cadence,
  anchor, category, display value, and per-period value overrides.
  *Acceptance:* adding a monthly benefit puts it on the runway immediately, and deleting
  one removes its redemptions with it.
  (depends: 4.10)

- [ ] **4.12 Build MSR, caps, and earn rate editing in CardDetail** — MSR add pre-filled
  from `spendThresholds`, user-entered caps, and earn rates constrained to the 14
  categories.
  *Acceptance:* a Hilton Aspire threshold pre-fills the MSR form without creating an MSR on
  its own, and a deadline is required to save.
  (depends: 4.10)

- [ ] **4.13 Build the CatalogSheet search-and-add tier** — search by name or issuer, then
  deep-copy the card with fresh UUIDs into the active profile.
  *Acceptance:* adding a catalog card seeds its benefits, editing them leaves
  `data/cards.json` byte-identical, and adding the same card twice yields two independent
  cards.
  (depends: 4.9, 1.6)

- [ ] **4.14 Build the Insights stats and best-card table** — recovery percentage, net
  cost, and the best owned card for each of the 14 categories with fallback marking.
  *Acceptance:* three cards with fees 695/250/95 and recovery 400/250/0 show $1,040,
  $650, 62.5%, and $390.
  (depends: 4.3, 2.8)

- [ ] **4.15 Build the wallet recommendations and spend entry** — 3/5/7-card wallets and
  current-month spend entry per category.
  *Acceptance:* entering dining spend recomputes the ranking immediately, and rapid typing
  produces one debounced write.
  (depends: 4.14)

- [ ] **4.16 Build Settings profile management** — create, rename, delete, and switch, with
  the last profile and non-empty profiles guarded.
  *Acceptance:* deleting a profile holding cards is refused until they are reassigned or
  deleted, and the last profile cannot be deleted.
  (depends: 4.3)

- [ ] **4.17 Build Settings server status and schema help** — connection state, last
  successful sync, a manual retry, and the in-app schema reference.
  *Acceptance:* with the service down, Settings states it is unreachable and Retry attempts
  immediately.
  (depends: 4.3, 3.14)

- [ ] **4.18 Persist per-device view preferences** — active profile and last tab in
  `localStorage`, degrading safely when a stored profile no longer exists.
  *Acceptance:* the last tab is restored on reload, the two devices keep separate profile
  selections, and no user data is written to `localStorage`.
  (depends: 4.3)

- [ ] **4.19 Phase 4 gate** — a one-handed pass over all four tabs in iOS Safari responsive
  mode, then add a card, mark a benefit used, and confirm it survives a refresh in a second
  browser.
  *Acceptance:* every target measures at least 44px (56px for the toggle), all actions fall
  in the lower two-thirds, and the cross-browser check passes.
  (depends: 4.8, 4.13, 4.15, 4.17, 4.18)

---

## Phase 5 — Import flow, PWA, deploy

Capabilities: `import-flow`, `pwa-deploy`. Gate: the seven-item acceptance sweep on real
devices.

- [ ] **5.1 Write docs/card-schema.md** — annotated example, field reference table, and the
  copy-paste LLM prompt block.
  *Acceptance:* output produced by pasting the prompt block plus a real benefits page into
  a chat window is accepted by the importer without editing.
  (depends: 1.6)

- [ ] **5.2 Implement src/catalog/importer.ts** — validate a full catalog card or a bare
  benefit, reporting every error by path with the accepted values, and rejecting unknown
  fields.
  *Acceptance:* a bad cadence reports
  `benefits[2].cadence must be monthly|quarterly|semiannual|annual`, and a paste with three
  distinct errors reports all three.
  (depends: 3.1, 5.1)

- [ ] **5.3 Write tests/importer.test.ts** — valid card, valid bare benefit, malformed
  JSON, bad enum, unknown field, and multiple simultaneous errors.
  *Acceptance:* the suite passes and a JSON parse failure is distinguished from a schema
  violation.
  (depends: 5.2)

- [ ] **5.4 Build the Paste JSON tier in CatalogSheet** — paste, validate, preview, then
  copy into state on confirm.
  *Acceptance:* dismissing the sheet after a preview leaves state unchanged and issues no
  PUT.
  (depends: 5.2, 4.13)

- [ ] **5.5 Build the blank-form tier** — minimal forms for a one-off card and a one-off
  benefit, with enum fields as pickers.
  *Acceptance:* a card can be created with only name, issuer, and fee, and an invalid
  cadence cannot be entered.
  (depends: 4.13)

- [ ] **5.6 Implement npm run validate:catalog** — a vitest schema check over
  `data/cards.json` runnable without the app.
  *Acceptance:* the committed catalog passes, and a hand-edited bad cadence fails with the
  card slug and the JSON path.
  (depends: 5.2)

- [ ] **5.7 Build state export** — download the whole blob as a dated JSON file from
  Settings, working even while the service is unreachable.
  *Acceptance:* the file contains all ten collections and `schemaVersion: 2`, and export
  succeeds with the server stopped.
  (depends: 4.16)

- [ ] **5.8 Build state import** — validate, show a confirm sheet summarizing what will be
  replaced, then replace the whole blob in a single PUT.
  *Acceptance:* export then import yields a deeply identical state and a byte-identical
  re-export, via exactly one PUT.
  (depends: 5.7, 5.2)

- [ ] **5.9 Add the PWA manifest and iOS meta** — `display: standalone`, `#0b1220` theme
  and background, 192/512 icons, apple-touch-icon, Apple meta tags, and
  `viewport-fit=cover`. No service worker.
  *Acceptance:* Add to Home Screen produces the app icon and launching it shows no Safari
  chrome; no service worker is registered.
  (depends: 4.1)

- [ ] **5.10 Write start_card_tracker.sh** — sources `.env`, builds `DATABASE_URL`, and
  execs uvicorn on `127.0.0.1:8101`.
  *Acceptance:* running the script starts the service on loopback with no credential
  literal in the file.
  (depends: 3.10)

- [ ] **5.11 Create and bootstrap the launchd agent** —
  `com.llm.card-tracker.plist` following the house-api shape, logging to
  `llm-infrastructure/logs/card-tracker.log`.
  *Acceptance:* killing the uvicorn process gets it restarted automatically, and it comes
  back after a reboot.
  (depends: 5.10)

- [ ] **5.12 Publish via tailscale serve** —
  `tailscale serve --bg --https=8443 http://127.0.0.1:8101`.
  *Acceptance:* the app loads over a valid certificate at
  `https://<your-machine>.<your-tailnet>.ts.net:8443/`, and the OpenRouter dashboard
  still answers on 443.
  (depends: 5.11)

- [ ] **5.13 Add monitoring and verify sleep is off** — a probe in `health_check.sh`, and
  `pmset -g` inspected and its output recorded.
  *Acceptance:* the health check reports the service up and then down when stopped, and the
  recorded `pmset -g` output confirms the machine will not sleep.
  (depends: 5.12)

- [ ] **5.14 Wire npm run deploy** — build, then copy `dist/*` into `server/static/`,
  aborting on a failed build.
  *Acceptance:* a successful run publishes the change on refresh with no service restart,
  and a failing build leaves the previous build in place.
  (depends: 1.10, 3.7)

- [ ] **5.15 Run the acceptance sweep** — all seven criteria exercised on a real iPhone and
  a real laptop, with results recorded.
  *Acceptance:* home-screen install, cross-device visibility both ways, the 409 refresh,
  the unreachable state, catalog add without catalog write-back, the Jan 31 quarterly
  windows, and the export/import round trip all pass.
  (depends: 5.4, 5.8, 5.9, 5.13, 5.14)

---

## Phase 6 — Docs

Capability: `docs`. Gate: a fresh clone can build and deploy from the README alone.

- [ ] **6.1 Rewrite README.md** — architecture, the four tabs, the npm scripts, the server
  setup, the deployment steps, and the app URL.
  *Acceptance:* the README mentions no Firebase and no localStorage data store, and covers
  every command needed from clone to deploy.
  (depends: 5.14)

- [ ] **6.2 Rewrite CLAUDE.md and AGENTS.md** — the new layering rules, build and test
  commands, and server layout, retaining the beads workflow block.
  *Acceptance:* neither file references the single-file app, `INITIAL_CARD_DATABASE`,
  `resolveCard`, or the legacy localStorage keys.
  (depends: 6.1)

- [ ] **6.3 Delete the stale documentation** — `FEATURES.md`, `FEATURES_DETAILED.md`,
  `INSTALLATION.md`, `QUICKSTART.md`, `USER_GUIDE.md`, `CHANGELOG.md`, and `docs/plans/`.
  *Acceptance:* those files are absent and no surviving document links to any of them.
  (depends: 6.1)

- [ ] **6.4 Phase 6 gate** — a fresh clone followed top to bottom from the README.
  *Acceptance:* a reader who has not seen the plan or the spec can install, test, build,
  and deploy with no undocumented step.
  (depends: 6.1, 6.2, 6.3)
