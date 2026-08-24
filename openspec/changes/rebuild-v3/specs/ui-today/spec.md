# Capability: UI — Today (the runway)

The home tab, and the two cross-cutting UI foundations every other view depends on.

**Scope note.** The first two requirements — the design token system and the shared
interaction mechanics — are **global**. They are specified here because Today is their
reference implementation and the first view built. `ui-wallet` and `ui-insights-settings`
inherit them and are not permitted to define their own palette, type scale, or target
sizes. Token values are fixed in `design.md` §7.

## ADDED Requirements

### Requirement: A single token system defines the visual language

The system SHALL define all colour, type, spacing, and motion values as CSS custom
properties in `src/ui/tokens.css`, using the values in `design.md` §7, and SHALL contain no
hardcoded colour or font-size literal anywhere else.

#### Scenario: No colour literals outside the token file

- **GIVEN** the files under `src/ui/` other than `tokens.css`
- **WHEN** they are searched for hex colours, `rgb(`, or `hsl(`
- **THEN** no match is found
- **AND** every colour is referenced as a `var(--…)`

#### Scenario: Accents carry one meaning each

- **GIVEN** the rendered app
- **WHEN** the accent colours are traced to their uses
- **THEN** mint appears only for done or redeemed, amber only for expiring soon, red only
  for at-risk or missed, sky only for informational, and violet only in the optimizer
- **AND** none is used decoratively

#### Scenario: Issuer accents are carried over

- **GIVEN** a wallet containing cards from all six issuers present in the catalog
- **WHEN** the wallet list is rendered
- **THEN** each card carries the issuer accent colour from the previous app's `.issuer-*`
  classes

#### Scenario: The type scale is respected with a body floor

- **GIVEN** the rendered app
- **WHEN** computed font sizes are collected
- **THEN** every value is one of 28, 22, 17, 15, or 13 px
- **AND** nothing below 17px is used for content the user must read to act — 15 and 13 are
  reserved for labels and metadata

#### Scenario: Money uses tabular numerals

- **GIVEN** any list showing dollar amounts
- **WHEN** a value changes from `$9` to `$1,250`
- **THEN** the digits stay in alignment with neighbouring rows
- **AND** `font-variant-numeric: tabular-nums` is applied

#### Scenario: Blur is confined to chrome

- **GIVEN** the rendered app
- **WHEN** elements carrying a backdrop filter are collected
- **THEN** they are only bottom sheets, the tab bar, and MSR cards
- **AND** no scrolling list row carries one

#### Scenario: Reduced motion is respected

- **GIVEN** a device with "Reduce Motion" enabled
- **WHEN** a sheet is opened and a toggle is tapped
- **THEN** no animation or transition plays
- **AND** all state changes are still visible instantly

---

### Requirement: Shared interaction mechanics are mobile-first

The system SHALL use bottom sheets rather than centered modals, SHALL enforce a 44px
minimum touch target with 56px for the redemption toggle, SHALL place everything actionable
in the bottom two-thirds of the viewport, and SHALL respect the bottom safe area.

#### Scenario: Every target clears the minimum

- **GIVEN** any view at a 390×844 viewport
- **WHEN** every interactive element's hit area is measured
- **THEN** each is at least 44×44 px
- **AND** each redemption toggle is at least 56×56 px

#### Scenario: Overlays are bottom sheets

- **GIVEN** any flow that presents an overlay — card detail, catalog, numeric pad, import
  confirm
- **WHEN** it opens
- **THEN** it enters from the bottom edge and is dismissible by dragging down
- **AND** no centered modal appears anywhere in the app

#### Scenario: One-handed reach is preserved

- **GIVEN** any tab at a 390×844 viewport
- **WHEN** the positions of primary actions are measured
- **THEN** each falls within the lower two-thirds of the viewport
- **AND** the top third holds only display content

#### Scenario: The safe area is honoured

- **GIVEN** the app running standalone on a device with a home indicator
- **WHEN** the tab bar and any open sheet are inspected
- **THEN** each carries bottom padding of `env(safe-area-inset-bottom)`
- **AND** no control sits under the home indicator

#### Scenario: Motion timing is consistent

- **GIVEN** sheet entry, toggle state change, and toast appearance
- **WHEN** their transitions are measured
- **THEN** each completes in 150–200 ms with an ease-out curve

---

### Requirement: The Today header is display-only

The system SHALL render a slim header showing the current month, a connection indicator,
and the active profile chip, and SHALL place no primary action in it.

#### Scenario: The header shows context, not controls

- **GIVEN** the Today tab
- **WHEN** the header is inspected
- **THEN** it shows the current month, a connection dot, and the active profile name
- **AND** the only tappable element is the profile chip, which switches profile

#### Scenario: The connection dot reflects service state

- **GIVEN** a healthy service
- **WHEN** the header is inspected
- **THEN** the dot is in its connected state
- **AND WHEN** the service becomes unreachable
- **THEN** the dot changes and the unreachable banner appears below the header

---

### Requirement: MSRs appear above everything, sorted by risk

The system SHALL render the MSR strip as the first content on Today, above all credits,
ordered by risk rather than by deadline.

#### Scenario: MSRs outrank credits

- **GIVEN** an active MSR and a credit expiring tomorrow
- **WHEN** Today is rendered
- **THEN** the MSR appears above the credit
- **AND** the credit's nearer deadline does not reorder them

#### Scenario: Each MSR card shows progress and pace

- **GIVEN** an MSR with `requirement: 4000`, `spent: 1500`, and 28 days remaining
- **WHEN** its card is rendered
- **THEN** it shows a progress bar at 37.5%
- **AND** the line `$2,500 left · 28 days · $625/wk needed`

#### Scenario: At-risk MSRs are visually distinguished

- **GIVEN** an at-risk MSR and a comfortable one
- **WHEN** they are rendered
- **THEN** the at-risk card carries an amber or red edge glow
- **AND** the comfortable one does not

#### Scenario: Logging spend is one tap to a numeric pad

- **GIVEN** an MSR card
- **WHEN** the user taps it
- **THEN** a bottom sheet with a large numeric pad opens
- **AND** entering an amount and confirming increases `spent` and updates the progress bar,
  the remaining figure, and the pace, without a confirmation dialog

#### Scenario: The strip is absent when there are no MSRs

- **GIVEN** no MSRs on the active profile
- **WHEN** Today is rendered
- **THEN** no empty MSR strip or placeholder is shown
- **AND** the runway list starts at the top of the content area

---

### Requirement: Credits are grouped by urgency

The system SHALL group the runway list into **Ending this week**, **Ending this month**, and
**Later this period**, computed from each benefit's current window end.

#### Scenario: A benefit lands in the correct group

- **GIVEN** three unredeemed benefits whose windows end in 3 days, 19 days, and 5 months
- **WHEN** Today is rendered
- **THEN** they appear under Ending this week, Ending this month, and Later this period
  respectively

#### Scenario: Empty groups are omitted

- **GIVEN** no benefit ending within 7 days
- **WHEN** Today is rendered
- **THEN** the Ending this week heading is not shown

#### Scenario: Each row shows what is at stake

- **GIVEN** a runway row
- **WHEN** it is rendered
- **THEN** it shows the benefit name, its card, its resolved period value, and days
  remaining
- **AND** a benefit with a null value shows its `displayValue` text in place of an amount

#### Scenario: Grouping uses calendar days, not milliseconds

- **GIVEN** a benefit whose window ends across a DST boundary exactly 7 days away
- **WHEN** it is grouped
- **THEN** it is placed by the whole-calendar-day count, consistently with `daysLeft`

---

### Requirement: Redeeming is a single tap with an undo path

The system SHALL provide a 56px toggle on every runway row that logs the full resolved
period value in one tap, undoes on a second tap, and offers an amount edit through a
transient toast — with no confirmation dialog anywhere in the flow.

#### Scenario: One tap logs the full value

- **GIVEN** an unredeemed benefit resolving to $15
- **WHEN** the user taps its toggle
- **THEN** a redemption of 15 is recorded for the current period key
- **AND** the row updates immediately with no dialog

#### Scenario: A second tap undoes it

- **GIVEN** a benefit just redeemed
- **WHEN** the user taps the toggle again
- **THEN** the redemption is removed and the row returns to unredeemed

#### Scenario: The toast offers a partial amount for five seconds

- **GIVEN** a benefit just redeemed by tap
- **WHEN** the toast appears
- **THEN** it offers "Edit amount" for 5 seconds
- **AND** tapping it opens the numeric pad pre-filled with the full value
- **AND** the toast dismisses itself without blocking anything

#### Scenario: No confirmation dialog exists in the redemption flow

- **GIVEN** the redemption and undo paths
- **WHEN** they are exercised
- **THEN** no confirm, alert, or "Are you sure" prompt appears

#### Scenario: Redeeming is refused while the service is unreachable

- **GIVEN** the unreachable state
- **WHEN** the user taps a toggle
- **THEN** the redemption is not recorded and the row does not change
- **AND** the banner explains why

---

### Requirement: Redeemed rows sink into a collapsed Done section

The system SHALL move redeemed benefits out of the urgency groups into a dimmed, collapsed
Done section at the bottom of the list.

#### Scenario: A redeemed row leaves the active list

- **GIVEN** a benefit under Ending this week
- **WHEN** it is redeemed
- **THEN** it leaves that group and appears inside Done
- **AND** the Done header shows how many are redeemed and their total value

#### Scenario: Done is collapsed by default and dimmed

- **GIVEN** Today with several redeemed benefits
- **WHEN** it is first rendered
- **THEN** Done is collapsed and its content is visually recessed
- **AND** tapping the header expands it

#### Scenario: Undo from Done returns the row to its group

- **GIVEN** an expanded Done section
- **WHEN** the user untoggles a benefit
- **THEN** it leaves Done and reappears under its urgency group

#### Scenario: A new period empties Done

- **GIVEN** a monthly benefit redeemed in the previous month
- **WHEN** the current month begins and Today is rendered
- **THEN** the benefit is back in an active group as unredeemed
- **AND** the previous month's redemption is still recorded under its own period key
