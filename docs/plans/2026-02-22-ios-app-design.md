# iOS App Design — Credit Card Benefit Tracker

**Date:** 2026-02-22
**Status:** Approved

---

## Overview

A native SwiftUI iOS app for personal use (sideloaded via Xcode, no App Store). Read-only — the card database is managed on the web app and imported via JSON. Core use case: quickly check and mark benefits used while you're out.

---

## Constraints

- Personal sideload only (no App Store, no review process)
- Read-only data model — no editing card definitions or benefit structures on device
- Import JSON from the existing web app to seed data; export back out via share sheet
- No push notifications
- SwiftUI + SwiftData (iOS 17+)
- Same JSON schema as web app — zero conversion on import/export

---

## Navigation

Bottom tab bar with four tabs:

| Tab | SF Symbol | Purpose |
|-----|-----------|---------|
| Today | `calendar` | Active benefits grouped by frequency — primary screen |
| Cards | `creditcard` | Card grid; tap for card detail |
| Optimizer | `chart.bar` | Spending inputs → best card per category |
| Settings | `gear` | Import/export JSON, profile management |

Today is the default tab.

---

## Screens

### Today

The HUD as a first-class screen. What you open the app for.

**Profile filter** — segmented picker (All / per-profile) at top when multiple profiles exist. Shared state across tabs.

**Stats strip** — horizontally scrollable row of four compact tiles:
- Annual Fees
- Recovered YTD
- Recovery Rate
- Net Cost

**Benefit sections** — `DisclosureGroup` per frequency in urgency order:
1. Monthly (expanded by default)
2. Quarterly (collapsed)
3. Semi-Annual (collapsed)
4. Annual (collapsed)

Each benefit row:
```
● $20 Dining Credit          Amex Gold
  Dining · Monthly                $20
```
- Colored dot = benefit type (amber = dining, blue = travel, purple = shopping)
- Card name right-aligned, muted
- Tap → toggles used/unused, haptic feedback
- Used rows: strikethrough text + green tint

---

### Cards

**Card grid** — 2-column `LazyVGrid` on iPhone.

Each tile:
- Issuer accent on top edge (inset top shadow, same colors as web app)
- Card name + profile badge
- Stats row: Fee / Available / YTD / Recovery%
- Recovery% color-coded: green ≥70%, amber 40–69%, red <40%
- Thin progress bar (3px), color matches recovery
- Benefit chips: current-period benefits as compact pills, type-colored, strikethrough if used

Tap tile → pushes **Card Detail**:
- Large header: card name, issuer, all four stats
- `List` of benefits grouped by frequency with section headers
- Each row: name, value, type badge
- Tap row → toggle used/unused with haptic
- Swipe to dismiss

---

### Optimizer

**Spending inputs** — SwiftUI `Form`, one row per category with `$` text field:
- Dining, Travel, Groceries, Gas, Entertainment, Other
- Values persisted to SwiftData

**Results** — live-updating (no button), hidden until at least one spend value entered:
```
Best card for Dining
  1. Amex Gold        4x → $480/yr
  2. Chase Sapphire   3x → $360/yr

Best card for Travel
  1. Amex Platinum    5x → $250/yr
  2. Venture X        2x → $100/yr
```
Categories with no spend entered are omitted from results. Scoring: best multiplier per category × annual spend.

---

### Settings

Standard SwiftUI `Form` with three sections:

**Profiles** — list profiles, add/rename. No delete (destructive ops stay on web app).

**Data**
- Import — Files app picker → reads web app JSON → merges into SwiftData
- Export — serializes SwiftData back to same JSON format → iOS share sheet

**App** — version number only.

---

## Data Model (SwiftData)

Four entities mirroring the web app's localStorage keys:

| Entity | Fields |
|--------|--------|
| `Profile` | `id: String`, `name: String` |
| `WalletCard` | `id: String`, `cardName: String`, `profileId: String` |
| `CardDefinition` | `name: String`, `issuer: String`, `annualFee: Double`, `periodicBenefitsJSON: String`, `multipliersJSON: String` |
| `UsedBenefit` | `cardId: String`, `benefitIndex: Int`, `year: Int`, `period: String` |

`periodicBenefitsJSON` and `multipliersJSON` are raw JSON strings — same structure as the web app blobs. This keeps import/export a straight `JSONDecoder`/`JSONEncoder` round-trip with no schema conversion.

Used benefit key mirrors web: `{cardId}-{benefitIndex}-{year}-{period}`.

---

## Key Logic (mirrors web app)

- `isCurrentPeriod(benefit)` — same monthly/quarterly/semi-annual/annual period logic
- `calculateCardStats(card)` — iterates all periodicBenefits for YTD recovery; tracks currentPeriodTotal separately
- `calculateOptimalWallet(cards, spending)` — Σ(spend × best multiplier per category); falls back to multiplier sum if no spend
- `recoveryClass` — green ≥70%, amber 40–69%, red <40%
- `URGENCY_ORDER` — Monthly:0, Quarterly:1, Semi-Annual:2, Annual:3

---

## What's Out of Scope (v1)

- Editing card definitions or benefit structures on device
- Adding/removing cards on device
- Push notifications
- iCloud sync
- Widget / lock screen extension
- Apple Watch companion
