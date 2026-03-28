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
