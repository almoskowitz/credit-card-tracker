# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Credit Card Rewards Tracker — a single-file React app for tracking credit card benefits, managing multiple profiles, and optimizing wallet strategy. No build process, no server, no dependencies to install.

## Development

**Run the app:** Open `credit-card-tracker-full.html` directly in a browser. On Windows: `start credit-card-tracker-full.html`.

There is no build step, no test suite, no linter, and no package manager. The entire application is one self-contained HTML file (~1650 lines) that loads React 18 + Babel via CDN and compiles JSX in the browser.

**Testing is manual:** Verify in Chrome/Firefox/Safari, check for console errors, confirm data persists after refresh, and test modal open/close behavior.

## Architecture

### Single-file structure (`credit-card-tracker-full.html`)

The file is organized in this order:
1. **CSS** (~670 lines) — All styles inline in a `<style>` tag. Glassmorphic dark theme using CSS variables (`:root`). Issuer-specific accent colors via `.issuer-*` classes.
2. **Data** (`INITIAL_CARD_DATABASE`, `SPENDING_CATEGORIES`) — Large inline JSON blob defining ~24 pre-loaded credit cards with their periodic benefits and multipliers.
3. **Utility functions** — `getCurrentMonth/Quarter/Half/Year`, `getPeriodKey`, `isCurrentPeriod` for period-based filtering.
4. **`ProgressCircle` component** — Small SVG donut chart.
5. **`App` component** (~900 lines) — Single monolithic component containing all state, logic, and rendering. Uses `useState` + `useEffect` for localStorage persistence.

### Data model

- **Profiles** have `id` and `name`. Cards reference profiles via `profileId`.
- **Cards** (in wallet) have `id`, `profileId`, `cardName` (FK to database), `issuer`, `annualFee`, plus resolved `periodicBenefits` and `multipliers` from the database.
- **`periodicBenefits`** — Each benefit has `frequency` (Monthly/Quarterly/Semi-Annual/Annual) and `period` (M1-M12, Q1-Q4, H1-H2, or omitted for Annual).
- **`usedBenefits`** — Object keyed as `${cardId}-${benefitIndex}-${year}-${period}`. Naturally scoped per year.
- **All state persists to `localStorage`** under keys: `profiles`, `cards`, `card-database`, `used-benefits`, `annual-spending`.

### Key functions

- `resolveCard(wc)` — Merges a wallet card with its database entry to get full benefit/multiplier data. Must be called before accessing `periodicBenefits`.
- `calculateCardStats(card)` — Iterates ALL periodic benefits (not just current period) for YTD recovery totals.
- `getTotalStats()` — Aggregates across all cards. Uses `stats.usedAnnualValue` for recovery, exposes `netCost`.
- `calculateOptimalWallet(walletSize)` — Scores cards by spending-weighted multipliers when spending data exists; falls back to multiplier sum.
- `isCurrentPeriod(benefit)` — Determines if a benefit is available in the current month/quarter/half/year.

### Rendering structure

The `App` component has three tab views rendered by:
- `renderDashboard()` — Stats strip, HUD (collapsible benefit list sorted by urgency), card grid with expandable benefit tiles.
- `renderDatabase()` — Card database management with add/edit forms.
- `renderOptimizer()` — Spending input, best-card-per-category analysis, wallet recommendations (3/5/7 card).

## Code Style

- 2-space indentation
- React functional components with hooks (no classes)
- Inline styles mixed with CSS classes
- `URGENCY_ORDER` constant: `{ Monthly: 0, Quarterly: 1, Semi-Annual: 2, Annual: 3 }`


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
