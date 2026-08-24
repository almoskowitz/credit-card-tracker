# Capability: Period Engine

Pure date and money math: reset windows, days remaining, effective benefit values,
minimum-spend derivations, fee break-even, and wallet optimization. No React, no HTTP, no
date library. This is the load-bearing part and the most likely place for a subtle bug —
everything else is UI.

Tests are written **red first**. The eleven scenarios tagged **PE-1** through **PE-11** are
the mandated period test cases and must exist as executable tests in `tests/period.test.ts`
before `src/engine/period.ts` is implemented.

## ADDED Requirements

### Requirement: Calendar-anchored windows align to January 1

The system SHALL, for a benefit with `anchor: "calendar"`, compute a window whose start is
the first day of the cadence bucket counted from January 1 of the current year, whose end
is the first day of the next bucket, and whose key is `"YYYY-MM"` using the 1-based month
of the window start.

#### Scenario: PE-4 — Calendar semiannual across the Dec 31 to Jan 1 boundary

- **GIVEN** a benefit with `cadence: "semiannual"` and `anchor: "calendar"`
- **WHEN** `periodFor` is called with `now = 2026-12-31T12:00:00` local
- **THEN** the window is `start = 2026-07-01`, `end = 2027-01-01`, `key = "2026-07"`
- **AND WHEN** it is called again with `now = 2027-01-01T12:00:00` local
- **THEN** the window is `start = 2027-01-01`, `end = 2027-07-01`, `key = "2027-01"`
- **AND** the two keys differ, so a redemption logged on December 31 does not mark the new
  half-year as redeemed

#### Scenario: PE-6 — A benefit added mid-period shows the in-flight window

- **GIVEN** a monthly calendar-anchored benefit created on 2026-08-20
- **WHEN** `periodFor` is called with `now = 2026-08-20T09:00:00` local
- **THEN** the window is `start = 2026-08-01`, `end = 2026-09-01`, `key = "2026-08"`
- **AND** the window is **not** a fresh 2026-08-20 to 2026-09-20 span
- **AND** the benefit appears in the current month's runway immediately rather than next
  month

#### Scenario: Annual calendar cadence uses the uniform key format

- **GIVEN** a benefit with `cadence: "annual"` and `anchor: "calendar"`
- **WHEN** `periodFor` is called with any `now` in 2026
- **THEN** the window is `start = 2026-01-01`, `end = 2027-01-01`
- **AND** the key is `"2026-01"`, not a bare `"2026"`

---

### Requirement: Anniversary-anchored windows track the card fee date

The system SHALL, for a benefit with `anchor: "anniversary"` on a card carrying a parseable
`anniversary` date, compute a window aligned to that date, advanced by whole multiples of
the cadence span, with a key of `"A" + YYYY-MM-DD` of the clamped window start.

#### Scenario: PE-1 — Jan 31 fee date, quarterly cadence, first window

- **GIVEN** a card with `anniversary: "2026-01-31"` and a benefit with
  `cadence: "quarterly"`, `anchor: "anniversary"`
- **WHEN** `periodFor` is called with `now = 2026-02-15T12:00:00` local
- **THEN** the window is `start = 2026-01-31`, `end = 2026-04-30`
- **AND** the key is `"A2026-01-31"`
- **AND** the end is April 30, not the non-existent April 31 and not May 1

#### Scenario: PE-2 — Jan 31 fee date, quarterly cadence, all four windows

- **GIVEN** the same card and benefit as PE-1
- **WHEN** `periodFor` is evaluated at a date inside each of the four fee-year quarters
- **THEN** the four windows are exactly:

  | Evaluated at | start | end | key |
  |---|---|---|---|
  | 2026-02-15 | 2026-01-31 | 2026-04-30 | `A2026-01-31` |
  | 2026-05-15 | 2026-04-30 | 2026-07-31 | `A2026-04-30` |
  | 2026-08-15 | 2026-07-31 | 2026-10-31 | `A2026-07-31` |
  | 2026-11-15 | 2026-10-31 | 2027-01-31 | `A2026-10-31` |

- **AND** the windows are contiguous with no gap and no overlap — each window's `end`
  equals the next window's `start`
- **AND** clamping is exercised at both ends: April 30 appears first as an end and then as
  the following window's start
- **AND** the fourth window's end returns to the 31st, proving the clamp is applied to the
  original anniversary day and does not degrade the series to the 30th

#### Scenario: PE-3 — Feb 29 fee date evaluated in a non-leap year

- **GIVEN** a card with `anniversary: "2024-02-29"` and an annual anniversary-anchored
  benefit
- **WHEN** `periodFor` is called with `now = 2027-06-01T12:00:00` local
- **THEN** the window is `start = 2027-02-28`, `end = 2028-02-29`
- **AND** the key is `"A2027-02-28"`
- **AND** no date rolls forward to March 1
- **AND** the end lands on February 29 because 2028 is a leap year, confirming the clamp is
  recomputed per target month rather than cached

#### Scenario: PE-11 — Day-31 anniversary in a short month advances correctly

- **GIVEN** a card with `anniversary: "2026-01-31"` and a benefit with `cadence: "monthly"`,
  `anchor: "anniversary"`
- **WHEN** `periodFor` is called with `now = 2026-02-28T12:00:00` local
- **THEN** the window is `start = 2026-02-28`, `end = 2026-03-31`, key `"A2026-02-28"`
- **AND** `now` falls inside its own computed window, satisfying `start <= now < end`
- **AND** the result is **not** the January window `2026-01-31` to `2026-02-28`, which the
  naive months-elapsed test produces and which would place `now` outside its own window
- **AND** the implementation reaches this by comparing `now.getDate()` against the
  anniversary day **clamped into the current month** (28), not against the raw day (31)

#### Scenario: Anniversary anchor with no anniversary set falls back to calendar

- **GIVEN** a benefit with `anchor: "anniversary"` on a card whose `anniversary` is `null`
- **WHEN** `periodFor` is called
- **THEN** it returns the calendar-anchored window for that cadence
- **AND** the key is in the `"YYYY-MM"` calendar format
- **AND** no exception is thrown

#### Scenario: Anniversary anchor with an unparseable anniversary falls back to calendar

- **GIVEN** a benefit with `anchor: "anniversary"` on a card whose `anniversary` is `""` or
  a malformed string
- **WHEN** `periodFor` is called
- **THEN** it returns the calendar-anchored window
- **AND** no exception is thrown and no `Invalid Date` reaches the caller

---

### Requirement: Day-of-month values are clamped to the target month

The system SHALL clamp any constructed day-of-month to the last valid day of its target
month, so that no date silently overflows into the following month.

#### Scenario: clampDay never overflows

- **GIVEN** `clampDay`
- **WHEN** it is called for day 31 in each month of 2026
- **THEN** it returns Jan 31, Feb 28, Mar 31, Apr 30, May 31, Jun 30, Jul 31, Aug 31,
  Sep 30, Oct 31, Nov 30, Dec 31
- **AND** no returned date has a month index other than the one requested

#### Scenario: clampDay respects leap years

- **GIVEN** `clampDay`
- **WHEN** it is called for day 31 in February of 2024 and of 2026
- **THEN** it returns 2024-02-29 and 2026-02-28 respectively

---

### Requirement: Days remaining are counted in whole calendar days

The system SHALL compute days remaining by differencing local calendar dates, and SHALL NOT
divide an elapsed-millisecond span by 86,400,000.

#### Scenario: PE-7 — DST fall-back does not distort the count

- **GIVEN** a local timezone observing DST, in which the offset changes on 2026-11-01
- **WHEN** `daysLeft` is called with `now = 2026-10-31T12:00:00` local and
  `end = 2026-11-03T12:00:00` local
- **THEN** it returns exactly 3
- **AND** the result is identical to the count for an equivalent three-day span that does
  not cross the boundary
- **AND** the naive millisecond division yields 3.04, which rounds or ceils inconsistently
  depending on the implementation

#### Scenario: PE-8 — DST spring-forward does not distort the count

- **GIVEN** a local timezone observing DST, in which the offset changes on 2026-03-08
- **WHEN** `daysLeft` is called with `now = 2026-03-07T12:00:00` local and
  `end = 2026-03-10T12:00:00` local
- **THEN** it returns exactly 3
- **AND** the naive millisecond division yields 2.958, which floors to 2 — an off-by-one in
  the direction that under-reports urgency

#### Scenario: A window ending today reports zero days left

- **GIVEN** `now = 2026-08-31T23:00:00` local and `end = 2026-08-31T00:00:00` local
- **WHEN** `daysLeft` is called
- **THEN** it returns 0
- **AND** the UI classifies the benefit as expiring today rather than as already expired

---

### Requirement: Window boundaries are start-inclusive and end-exclusive

The system SHALL treat a window as `start <= now < end`, so that consecutive windows tile
the timeline with no gap and no overlap.

#### Scenario: PE-5 — now at exact local midnight on a boundary

- **GIVEN** a monthly calendar-anchored benefit
- **WHEN** `periodFor` is called with `now = 2026-09-01T00:00:00.000` local
- **THEN** the window is `start = 2026-09-01`, `end = 2026-10-01`, key `"2026-09"`
- **AND WHEN** it is called with `now = 2026-08-31T23:59:59.999` local
- **THEN** the window is `start = 2026-08-01`, `end = 2026-09-01`, key `"2026-08"`
- **AND** the instant `2026-09-01T00:00:00.000` belongs to exactly one window

#### Scenario: Anniversary boundaries tile without gaps

- **GIVEN** the Jan 31 quarterly card from PE-2
- **WHEN** `periodFor` is called at `2026-04-29T23:59:59` and at `2026-04-30T00:00:00` local
- **THEN** the first returns key `"A2026-01-31"` and the second returns `"A2026-04-30"`

---

### Requirement: Period keys are stable forever

The system SHALL emit period keys in exactly the documented formats — `"YYYY-MM"` for
calendar anchors and `"AYYYY-MM-DD"` for anniversary anchors — and SHALL pin them with a
snapshot test, because the key is the redemption ledger key and changing its format orphans
all history.

#### Scenario: PE-10 — Key format snapshot

- **GIVEN** a fixed table of (cadence, anchor, card anniversary, `now`) tuples covering all
  four cadences under both anchors
- **WHEN** `periodFor` is evaluated for each
- **THEN** the emitted keys match the committed snapshot exactly, character for character
- **AND** the test fails on any change to padding, separator, prefix, or field order

#### Scenario: The ledger key composes benefit id and period key

- **GIVEN** a benefit with id `b-123` whose current window key is `"2026-07"`
- **WHEN** a redemption is recorded
- **THEN** it is stored under the key `"b-123|2026-07"`
- **AND** the separator is a single pipe character with no surrounding whitespace

---

### Requirement: Value overrides resolve per window

The system SHALL resolve a benefit's effective value for a window by preferring a matching
`valueOverrides` entry, then the benefit's `value`, and SHALL propagate `null` as "display
but exclude from dollar math".

#### Scenario: PE-9 — Uber Cash resolves to 20 in December and 15 otherwise

- **GIVEN** a monthly benefit with `value: 15` and `valueOverrides: { "M12": 20 }`
- **WHEN** its value is resolved for the window starting 2026-12-01
- **THEN** the result is 20
- **AND WHEN** it is resolved for the window starting 2026-11-01
- **THEN** the result is 15
- **AND** the December override does not affect the annual total for any other month

#### Scenario: Override suffixes are derived from the window start

- **GIVEN** benefits of each cadence carrying overrides
- **WHEN** their values are resolved
- **THEN** monthly windows look up `M1`–`M12`, quarterly `Q1`–`Q4`, semiannual `H1`–`H2`,
  all derived from the window start month
- **AND** annual benefits ignore `valueOverrides` entirely

#### Scenario: A null value is displayed but excluded from totals

- **GIVEN** a benefit with `value: null` and `displayValue: "Up to 85k pts"`
- **WHEN** the card's potential and recovered totals are computed
- **THEN** the benefit contributes nothing to either
- **AND** the card's recovery percentage is unchanged by its presence
- **AND** the benefit is still listed in the runway showing `Up to 85k pts`

---

### Requirement: Minimum-spend requirements expose remaining, pace, and risk

The system SHALL derive, for each MSR, the amount remaining, the days to deadline, the
required spend per week, and an `atRisk` flag.

#### Scenario: Basic derivations

- **GIVEN** an MSR with `requirement: 4000`, `spent: 1500`, and `deadline` 28 days away
- **WHEN** it is evaluated
- **THEN** `remaining` is 2500, `daysToDeadline` is 28, and `perWeek` is 625

#### Scenario: At risk because the pace exceeds the run rate

- **GIVEN** spend history whose trailing three months total $3,900 — a weekly run rate of
  $300
- **AND** an MSR requiring $625 per week to finish on time
- **WHEN** it is evaluated
- **THEN** `atRisk` is true

#### Scenario: At risk by the no-history fallback

- **GIVEN** an MSR with `remaining: 800` and a deadline 10 days away
- **AND** no month present in `state.spend`
- **WHEN** it is evaluated
- **THEN** `atRisk` is true, via the fallback rule `daysToDeadline < 14 && remaining > 0`

#### Scenario: Not at risk with no history and a distant deadline

- **GIVEN** an MSR with `remaining: 800`, a deadline 60 days away, and no spend history
- **WHEN** it is evaluated
- **THEN** `atRisk` is false

#### Scenario: A completed MSR is never at risk

- **GIVEN** an MSR with `spent >= requirement` and a deadline tomorrow
- **WHEN** it is evaluated
- **THEN** `remaining` is 0 and `atRisk` is false

#### Scenario: MSRs sort by risk, not by date

- **GIVEN** three MSRs — A at risk needing $900/wk, B at risk needing $400/wk, C not at
  risk with the nearest deadline
- **WHEN** they are sorted for the Today strip
- **THEN** the order is A, B, C
- **AND** C's nearer deadline does not lift it above the at-risk pair

#### Scenario: A missed MSR sorts first

- **GIVEN** an MSR whose deadline has passed with `remaining > 0`
- **WHEN** the list is sorted
- **THEN** it appears first
- **AND** it is flagged as missed rather than merely at risk

---

### Requirement: Break-even derives recovery and net cost

The system SHALL compute, per card and across the active profile, the amount recovered from
redemptions in the current year, the potential annual value, the recovery percentage capped
at 100, and the net cost floored at zero.

#### Scenario: Per-card recovery

- **GIVEN** a card with `fee: 695` and $400 of redemptions recorded in the current year
- **WHEN** break-even is computed
- **THEN** `recoveryPct` is 57.6 (rounded for display) and `netCost` is 295

#### Scenario: Recovery is capped and net cost floored

- **GIVEN** a card with `fee: 95` and $300 of redemptions
- **WHEN** break-even is computed
- **THEN** `recoveryPct` is 100, not 316
- **AND** `netCost` is 0, not −205

#### Scenario: A no-fee card does not divide by zero

- **GIVEN** a card with `fee: 0` and $50 of redemptions
- **WHEN** break-even is computed
- **THEN** `recoveryPct` is 0 and `netCost` is 0
- **AND** no `NaN` or `Infinity` reaches the UI

#### Scenario: Potential value expands recurring benefits across the year

- **GIVEN** a card whose only benefit is monthly at $15 with a December override of $20
- **WHEN** potential annual value is computed
- **THEN** it is 185, being eleven months at 15 plus one at 20

#### Scenario: Portfolio totals aggregate the active profile only

- **GIVEN** two profiles each holding cards with fees
- **WHEN** portfolio break-even is computed with one profile active
- **THEN** only that profile's cards contribute to total fees and total recovered

---

### Requirement: The optimizer scores cards on the explicit taxonomy

The system SHALL identify the best owned card per category and produce optimal 3, 5, and
7-card wallets, using exact category-slug lookups with no string matching.

#### Scenario: Best card per category is an exact lookup

- **GIVEN** owned cards with earn rates on `dining` of 4, 3, and 1
- **WHEN** the best card for `dining` is requested
- **THEN** the card with rate 4 is returned along with that rate
- **AND** no substring comparison of category names is performed

#### Scenario: A card with no rate for a category falls back

- **GIVEN** a card with an `everything-else` rate of 2 and no `dining` rate
- **WHEN** its effective rate for `dining` is requested
- **THEN** 2 is returned
- **AND** a card with neither returns 1

#### Scenario: Wallets are scored by spending when spend data exists

- **GIVEN** annual spend of $12,000 on dining and $2,000 on gas
- **WHEN** the optimal 3-card wallet is computed
- **THEN** each card's score is the sum over categories of spend times that card's best
  rate for the category
- **AND** the three highest-scoring cards are returned in descending score order

#### Scenario: Wallets fall back to rate sums with no spend data

- **GIVEN** an empty `spend` map
- **WHEN** the optimal 5-card wallet is computed
- **THEN** each card is scored by the sum of its earn rates
- **AND** five cards are returned without error

#### Scenario: Requesting more cards than are owned returns what exists

- **GIVEN** a wallet of 4 cards
- **WHEN** the optimal 7-card wallet is computed
- **THEN** all 4 are returned, ranked
- **AND** no padding or placeholder entry is produced

---

### Requirement: The engine phase is gated on a green test run with no UI

The system SHALL have all engine tests passing before any UI work begins, and the engine
modules SHALL import nothing from React or from the storage layer.

#### Scenario: Engine tests pass in isolation

- **GIVEN** the completed engine phase
- **WHEN** `npx vitest run` is executed
- **THEN** all tests in `tests/period.test.ts` and `tests/msr.test.ts` pass
- **AND** no test requires a DOM, a renderer, or a network mock

#### Scenario: The engine has no React or HTTP imports

- **GIVEN** the files under `src/engine/`
- **WHEN** their import statements are inspected
- **THEN** none references `react`, `src/ui/`, or `src/storage/`
