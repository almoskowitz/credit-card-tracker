# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Credit Card Rewards Tracker — a single-user benefits tracker. Vite + React + TypeScript
client, FastAPI + Postgres state service. See `README.md` for the full architecture,
dev workflow, and deploy steps; this file covers conventions an agent needs to not break.

## Layering — the one rule that matters

```
src/engine/    pure functions, no React, no dates library (period.ts, msr.ts, breakeven.ts, optimizer.ts)
src/state/     schema.ts, actions.ts, store.tsx (reducer + connection guard), selectors.ts
src/storage/   api.ts — the ONLY module allowed to call fetch('/api/...')
src/catalog/   catalog.ts (copy-on-add), categories.ts, importer.ts
src/ui/        components/ and views/ (Today, Wallet, Insights, Settings)
server/        FastAPI: app.py (mounts), state.py (GET/PUT /api/state), db.py (asyncpg pool)
```

**The engine and selectors are React-free. The store is HTTP-free. Only `src/storage/`
may speak to the API.** If you find yourself importing `fetch` or a status code outside
`src/storage/api.ts`, or importing React inside `src/engine/`, stop — that's the layering
rule breaking.

`src/state/store.tsx`'s reducer rejects mutating actions outright while
`connection === 'unreachable'` (one check at the boundary, in `storeReducer`) — components
never need to check connection state themselves before dispatching.

## Conventions

- **Tokens only.** Every color, font-size, spacing, and motion value lives in
  `src/ui/tokens.css`. No other file under `src/ui/` may hold a color or font-size
  literal — reference the CSS variable instead.
- **Period-key stability.** `src/engine/period.ts` derives a period's `key` from its
  `start` date (e.g. `2026-03` for calendar, `A2026-01-31` for anniversary). Changing how
  a key is formatted invalidates every existing `redemptions` entry keyed
  `<benefitId>|<periodKey>` — treat the key format as a migration, not a refactor.
- **Catalog copy-on-add.** `copyCardFromCatalog()` in `src/catalog/catalog.ts` deep-copies
  a catalog card into user state with fresh UUIDs on every entity. The catalog
  (`data/cards.json`) is never read live again for a card the user already owns — `slug`
  on the resulting `Card` is provenance only, never a lookup key.
- **No localStorage data.** The only `localStorage` key is `card-tracker:view-prefs`
  (`src/ui/viewPrefs.ts`) — the last tab and active profile, i.e. per-device view state.
  All app data lives in the single `State` blob synced through `src/storage/api.ts`, and
  there is no local write queue: an edit made while the server is unreachable is applied
  in memory and lost if it isn't flushed before the tab closes (see `attemptRecovery` /
  `handleSaveFailure` in `src/storage/api.ts`).
- **`updatedAt` is an opaque string.** Never parse it into a `Date` on the client or the
  server — it's compared for exact string equality only (`server/state.py`).

## Commands

```bash
npm test                  # vitest run — all suites (69 tests as of the v3 rebuild)
npm run validate:catalog  # vitest run tests/catalog.test.ts
npm run build             # vite build -> dist/
npm run deploy             # build, then copy dist/* into server/static/
```

No linter is configured. TypeScript strict mode (`tsconfig.json`) is the only static
check; `noUnusedLocals`/`noUnusedParameters` are on.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
