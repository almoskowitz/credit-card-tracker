# Capability: UI — Wallet

The card list, the card detail sheet where all editing happens, and the entry point to the
catalog.

Inherits the design tokens and shared interaction mechanics defined in `ui-today`.

## ADDED Requirements

### Requirement: The wallet lists cards with issuer identity and break-even at a glance

The system SHALL render each card in the active profile as a row carrying its issuer accent
edge and a fee break-even bar.

#### Scenario: A card row shows recovery against its fee

- **GIVEN** a card with `fee: 695` and $400 recovered this year
- **WHEN** the wallet list is rendered
- **THEN** the row shows the card name, issuer, the fee, and a bar filled to 57.6%
- **AND** the remaining net cost of $295 is shown

#### Scenario: Issuer accent identifies the card without reading

- **GIVEN** cards from American Express, Chase, Capital One, Citi, Barclays, and Bank of
  America
- **WHEN** the list is rendered
- **THEN** each row carries its issuer's accent colour on a leading edge

#### Scenario: A no-fee card shows value rather than an empty bar

- **GIVEN** a card with `fee: 0`
- **WHEN** its row is rendered
- **THEN** no break-even bar is shown
- **AND** the value recovered this year is shown instead

#### Scenario: An empty wallet invites the first card

- **GIVEN** a profile with no cards
- **WHEN** the wallet is rendered
- **THEN** an empty state explains how to add a card and points at the "+" control

#### Scenario: Only the active profile's cards appear

- **GIVEN** cards split across two profiles
- **WHEN** the wallet is rendered
- **THEN** only the active profile's cards are listed

---

### Requirement: Card detail is a drag-dismissible bottom sheet

The system SHALL open a bottom sheet when a card row is tapped, containing everything
editable about that card, dismissible by dragging down.

#### Scenario: The sheet opens and dismisses by gesture

- **GIVEN** the wallet list
- **WHEN** a card row is tapped
- **THEN** a bottom sheet rises with that card's detail
- **AND** dragging it down dismisses it without a close button being required

#### Scenario: The sheet leads with break-even

- **GIVEN** an open card detail sheet
- **WHEN** its top section is inspected
- **THEN** a break-even meter shows recovered, potential, fee, and net cost for the year

#### Scenario: Edits persist and close cleanly

- **GIVEN** an open sheet in which a field was edited
- **WHEN** the sheet is dismissed
- **THEN** the change is already saved and the wallet row reflects it
- **AND** no explicit save action was required

---

### Requirement: Card identity and dates are editable

The system SHALL allow editing a card's name, issuer, fee, anniversary, opened, and closed
dates, and SHALL make the anniversary drive anniversary-anchored periods immediately.

#### Scenario: Setting an anniversary switches windows for anchored benefits

- **GIVEN** a card with no anniversary and a benefit set to `anchor: "anniversary"`, which
  is therefore falling back to calendar windows
- **WHEN** the anniversary is set to 2026-01-31
- **THEN** that benefit's window becomes the anniversary-anchored one
- **AND** its period key changes to the `A`-prefixed format for future redemptions

#### Scenario: Clearing an anniversary falls back without error

- **GIVEN** a card with anniversary-anchored benefits
- **WHEN** the anniversary is cleared
- **THEN** those benefits revert to calendar windows
- **AND** nothing throws and no benefit disappears

#### Scenario: A closed card leaves the active views

- **GIVEN** a card with a `closed` date in the past
- **WHEN** Today and the wallet are rendered
- **THEN** the card and its benefits are excluded from the runway and from portfolio
  break-even
- **AND** its historical redemptions remain in state

---

### Requirement: Benefits are fully editable from the card detail sheet

The system SHALL support creating, editing, and deleting benefits on a card, including
name, value, display value, cadence, anchor, category, and notes.

#### Scenario: Adding a benefit puts it on the runway immediately

- **GIVEN** an open card detail sheet
- **WHEN** a monthly $25 dining benefit is added
- **THEN** it appears in Today's runway for the current window without a reload

#### Scenario: Changing cadence recomputes the window

- **GIVEN** a monthly benefit
- **WHEN** its cadence is changed to quarterly
- **THEN** its window and period key change accordingly
- **AND** redemptions recorded under the old monthly keys remain in state and are not
  displayed against the new window

#### Scenario: A benefit can be given a non-monetary value

- **GIVEN** an open sheet
- **WHEN** a benefit is added with no amount and the display text "Up to 85k pts"
- **THEN** it is stored with `value: null` and that `displayValue`
- **AND** it appears on the runway showing the text and contributes nothing to break-even

#### Scenario: Deleting a benefit removes its redemptions

- **GIVEN** a benefit with redemptions in three periods
- **WHEN** it is deleted
- **THEN** the benefit and all three redemption entries are removed together
- **AND** the card's recovery total drops accordingly

#### Scenario: Value overrides are editable

- **GIVEN** a monthly benefit with `valueOverrides: {"M12": 20}` seeded from the catalog
- **WHEN** the override is inspected in the sheet
- **THEN** it is visible and editable per period
- **AND** removing it makes December resolve to the base value

---

### Requirement: MSRs are added pre-filled from spend threshold seeds

The system SHALL offer an MSR add form on the card detail sheet, pre-filling the label and
requirement from the card's catalog `spendThresholds` when any exist.

#### Scenario: A seeded threshold pre-fills the form

- **GIVEN** a Hilton Aspire card added from the catalog, carrying the "Second Free Night"
  threshold at $30,000
- **WHEN** the user opens the MSR add form
- **THEN** that threshold is offered as a suggestion
- **AND** selecting it pre-fills the label as "Second Free Night" and the requirement as
  30000, leaving the deadline for the user

#### Scenario: Seeds do not create MSRs on their own

- **GIVEN** a card with spend thresholds just added from the catalog
- **WHEN** the wallet and Today are rendered
- **THEN** no MSR exists for that card
- **AND** the MSR strip on Today is unaffected

#### Scenario: An MSR can be created from scratch

- **GIVEN** a card with no spend thresholds
- **WHEN** the user adds an MSR with a label, requirement, deadline, and bonus value
- **THEN** it is created and appears on Today's MSR strip

#### Scenario: A deadline is required

- **GIVEN** the MSR add form with a requirement but no deadline
- **WHEN** the user attempts to save
- **THEN** the form indicates the deadline is required
- **AND** no MSR is created, because risk cannot be computed without it

---

### Requirement: Caps and earn rates are editable on the card

The system SHALL support creating, editing, and deleting caps and earn rates from the card
detail sheet.

#### Scenario: A cap is user-entered because none is seeded

- **GIVEN** any card added from the catalog
- **WHEN** its caps are inspected
- **THEN** there are none, because the catalog carries no cap data
- **AND** the user can add one with a label, limit, cadence, and used amount

#### Scenario: Earn rates are constrained to the taxonomy

- **GIVEN** the earn rate editor
- **WHEN** a category is chosen
- **THEN** it is selected from the 14 canonical categories
- **AND** free text is not accepted as a category

#### Scenario: An edited earn rate changes the optimizer

- **GIVEN** a card whose dining rate is raised above every other card's
- **WHEN** Insights is opened
- **THEN** that card is shown as the best card for dining

---

### Requirement: The "+" control opens the catalog sheet

The system SHALL provide a single add affordance on the Wallet tab that opens a bottom
sheet offering three ways to add a card: searching the catalog, pasting JSON, or filling a
blank form.

#### Scenario: The catalog is reachable only from Wallet

- **GIVEN** the four bottom tabs
- **WHEN** they are inspected
- **THEN** there is no Catalog tab
- **AND** the catalog is reached only through the Wallet "+" control

#### Scenario: Searching the catalog finds a card by name or issuer

- **GIVEN** the catalog sheet with the 24-card catalog loaded
- **WHEN** the user types "hyatt"
- **THEN** World of Hyatt is shown
- **AND WHEN** the user types "barclays"
- **THEN** the Barclays cards are shown

#### Scenario: Adding from search copies the card into the active profile

- **GIVEN** a search result
- **WHEN** the user taps to add it
- **THEN** the card, its benefits, and its earn rates are deep-copied into state with fresh
  UUIDs and the active `profileId`
- **AND** the sheet closes and the new card appears in the wallet

#### Scenario: A card already owned is still addable

- **GIVEN** a wallet already containing Amex Platinum
- **WHEN** the user adds Amex Platinum again
- **THEN** a second independent card is created
- **AND** the list makes the two distinguishable so the user can rename one
