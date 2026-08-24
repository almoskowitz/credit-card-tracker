# Capability: UI — Insights & Settings

The two supporting tabs: Insights merges the old dashboard and optimizer; Settings holds
profiles, the export/import escape hatch, server status, and schema help. Also covers the
app shell — the four bottom tabs — and per-device view preferences.

Inherits the design tokens and shared interaction mechanics defined in `ui-today`.

## ADDED Requirements

### Requirement: The app has exactly four bottom tabs

The system SHALL present a bottom tab bar with Today, Wallet, Insights, and Settings, with
Today as the default, and SHALL expose no other top-level navigation.

#### Scenario: The tab bar is complete and minimal

- **GIVEN** the running app
- **WHEN** the tab bar is inspected
- **THEN** it contains exactly Today, Wallet, Insights, and Settings
- **AND** it is fixed to the bottom with `env(safe-area-inset-bottom)` padding

#### Scenario: A first-time load opens Today

- **GIVEN** a device with no stored view preference
- **WHEN** the app loads
- **THEN** the Today tab is active

#### Scenario: Switching tabs preserves scroll and does not refetch

- **GIVEN** Today scrolled partway down
- **WHEN** the user moves to Insights and back
- **THEN** Today's scroll position is preserved
- **AND** no `GET /api/state` is issued for the tab change

---

### Requirement: Per-device view preferences persist locally

The system SHALL remember the last selected tab and the active profile per device in
`localStorage`.

#### Scenario: The last tab is restored

- **GIVEN** a user who last viewed Wallet
- **WHEN** the app is reopened on that device
- **THEN** Wallet is active

#### Scenario: Profile selection does not propagate between devices

- **GIVEN** the phone on the Business profile and the laptop on Personal
- **WHEN** either device refreshes
- **THEN** each keeps its own selection

#### Scenario: A stale stored preference degrades safely

- **GIVEN** a stored `activeProfileId` for a profile that has since been deleted
- **WHEN** the app loads
- **THEN** it falls back to the first profile
- **AND** does not render an empty wallet or throw

---

### Requirement: Insights reports portfolio recovery and net cost

The system SHALL show total annual fees, total recovered this year, the overall recovery
percentage, and the net cost, across the active profile.

#### Scenario: Portfolio totals aggregate correctly

- **GIVEN** three cards with fees of 695, 250, and 95, and recovered amounts of 400, 250,
  and 0
- **WHEN** Insights is rendered
- **THEN** total fees show $1,040, total recovered $650, overall recovery 62.5%, and net
  cost $390

#### Scenario: Recovery cannot exceed 100 percent

- **GIVEN** a portfolio where recovered exceeds fees
- **WHEN** Insights is rendered
- **THEN** overall recovery displays as 100% and net cost as $0

#### Scenario: An empty portfolio shows zeros, not errors

- **GIVEN** no cards on the active profile
- **WHEN** Insights is rendered
- **THEN** all figures show zero and no division-by-zero artifact appears

---

### Requirement: Insights names the best card per category

The system SHALL show, for each of the 14 categories, the owned card with the highest earn
rate and that rate.

#### Scenario: The best card is resolved by exact category

- **GIVEN** owned cards with dining rates of 4, 3, and 1
- **WHEN** Insights is rendered
- **THEN** the dining row names the card with rate 4 and shows 4x

#### Scenario: A category with no rate falls back visibly

- **GIVEN** no owned card carrying a shipping rate, but one with an `everything-else` rate
  of 2
- **WHEN** the shipping row is rendered
- **THEN** it names that card at 2x
- **AND** it is marked as a fallback rather than a category bonus

#### Scenario: Categories are the canonical fourteen

- **GIVEN** the best-card table
- **WHEN** its rows are counted
- **THEN** there are 14, matching the taxonomy, in a stable order

---

### Requirement: Insights recommends 3, 5, and 7-card wallets

The system SHALL compute optimal wallets at sizes 3, 5, and 7, weighted by spending when
spend data exists.

#### Scenario: Spending weights the recommendation

- **GIVEN** annual spend heavily concentrated in dining
- **WHEN** the 3-card wallet is computed
- **THEN** the card with the highest dining rate ranks first
- **AND** each card's score is shown

#### Scenario: No spending data still produces a ranking

- **GIVEN** an empty spend map
- **WHEN** the wallets are computed
- **THEN** cards are ranked by the sum of their earn rates
- **AND** the view indicates the ranking is unweighted and invites spend entry

#### Scenario: A small wallet is handled gracefully

- **GIVEN** only 4 owned cards
- **WHEN** the 7-card wallet is rendered
- **THEN** all 4 are listed with no placeholder rows

---

### Requirement: Insights offers quick current-month spend entry

The system SHALL let the user enter or adjust the current month's spend per category from
Insights, writing to `spend["YYYY-MM"]`.

#### Scenario: Entering spend updates the recommendation

- **GIVEN** the spend entry section
- **WHEN** $1,200 of dining spend is entered for the current month
- **THEN** `spend` gains that value under the current month key
- **AND** the wallet recommendations recompute immediately

#### Scenario: Typing does not flood the server

- **GIVEN** the user typing a spend figure
- **WHEN** several keystrokes occur within a second
- **THEN** a single debounced write is issued after typing stops

#### Scenario: Spend feeds the MSR run rate

- **GIVEN** three months of spend history entered
- **WHEN** an MSR's risk is evaluated
- **THEN** the trailing three-month weekly run rate is derived from that history rather
  than the no-history fallback

---

### Requirement: Settings manages profiles

The system SHALL allow creating, renaming, deleting, and switching profiles from Settings.

#### Scenario: A new profile starts empty and can be switched to

- **GIVEN** Settings
- **WHEN** a profile named "Business" is created and selected
- **THEN** the wallet is empty for that profile and Today shows its empty state
- **AND** the Personal profile's cards are untouched

#### Scenario: Deleting a profile with cards is guarded

- **GIVEN** a profile holding cards
- **WHEN** deletion is attempted
- **THEN** the app requires the cards to be reassigned or deleted first
- **AND** the profile is not removed until they are

#### Scenario: The last profile cannot be deleted

- **GIVEN** exactly one profile
- **WHEN** deletion is attempted
- **THEN** it is refused with an explanation

---

### Requirement: Settings surfaces server status and schema help

The system SHALL show connection state and the last successful sync time, and SHALL link to
the import schema documentation.

#### Scenario: Status reflects a healthy connection

- **GIVEN** a reachable service
- **WHEN** Settings is opened
- **THEN** it shows connected and the time of the last successful sync

#### Scenario: Status reflects an outage with a retry

- **GIVEN** an unreachable service
- **WHEN** Settings is opened
- **THEN** it states the service is unreachable, shows when contact was last made, and
  offers a Retry control that attempts immediately

#### Scenario: Schema help is reachable in-app

- **GIVEN** Settings
- **WHEN** the schema help entry is opened
- **THEN** the import schema is shown, including the copy-paste LLM prompt block
- **AND** its content matches `docs/card-schema.md`
