# Capability: Catalog

Extraction of card reference data out of the legacy app into `data/cards.json`, and the
copy-on-add semantics that keep user state independent of it.

## ADDED Requirements

### Requirement: Extraction runs against the legacy blob before it is replaced

The system SHALL extract the card database from the JSON literal at `index.html:749` using
`tools/extract_catalog.mjs`, a dependency-free Node script, and SHALL do so before
`index.html` is replaced by the Vite entry point.

#### Scenario: Extraction produces the catalog from the legacy file

- **GIVEN** the repository at a commit where `index.html` still contains the legacy
  `INITIAL_CARD_DATABASE` literal on line 749
- **WHEN** `node tools/extract_catalog.mjs` is run
- **THEN** `data/cards.json` is written containing 24 cards
- **AND** the script exits 0
- **AND** it requires no `npm install`

#### Scenario: Extraction refuses to run against a replaced file

- **GIVEN** `index.html` no longer contains a parseable card database literal
- **WHEN** the extraction script is run
- **THEN** it exits non-zero with a message naming the file and line it expected
- **AND** it does not write or truncate `data/cards.json`

---

### Requirement: Exploded period rows collapse into recurring definitions

The system SHALL group benefit rows by card, base name (the benefit name with a trailing
` Jan`…` Dec`, ` Q1`…` Q4`, or ` H1`…` H2` suffix removed), and frequency; and SHALL emit
one recurring benefit definition per complete-span group.

#### Scenario: A uniform twelve-month group collapses to one benefit

- **GIVEN** a card with 12 monthly rows sharing a base name and an identical value
- **WHEN** the extraction runs
- **THEN** exactly one benefit is emitted with `cadence: "monthly"` and that value
- **AND** the emitted benefit has no `valueOverrides` key

#### Scenario: The full input collapses to the measured counts

- **GIVEN** the legacy blob with 283 benefit rows (216 monthly, 32 quarterly, 18
  semi-annual, 17 annual)
- **WHEN** the extraction runs
- **THEN** 52 benefit definitions are emitted in total
- **AND** those comprise 18 monthly, 8 quarterly, 9 semiannual, and 17 annual definitions

#### Scenario: An ill-formed group is emitted un-collapsed with a report

- **GIVEN** a group whose members do not form a complete span — a missing period, a
  duplicated period, or an unparseable suffix
- **WHEN** the extraction runs
- **THEN** every member of that group is emitted as its own individual benefit, unchanged
- **AND** a line naming the card, the base name, and the members found is written to stderr
- **AND** the run still completes rather than aborting

---

### Requirement: Within-group value variation becomes valueOverrides

The system SHALL, when a complete-span group's members do not all share one value, emit a
single benefit whose `value` is the modal value and whose `valueOverrides` maps each
deviating member's period suffix to its own value.

#### Scenario: Amex Platinum Uber Cash keeps its December uplift

- **GIVEN** the Amex Platinum monthly `Uber Cash` group with $15 in January through
  November and $20 in December
- **WHEN** the extraction runs
- **THEN** one benefit is emitted named `Uber Cash` with `value: 15`
- **AND** its `valueOverrides` is exactly `{ "M12": 20 }`
- **AND** it is the only benefit in the entire catalog carrying a `valueOverrides` key

---

### Requirement: Polymorphic benefit values are normalized

The system SHALL emit a numeric `value` and a string `displayValue`, resolving the legacy
format where `value` may hold either a number or free text.

#### Scenario: A numeric value carries no display string

- **GIVEN** a source row with `value: 15`
- **WHEN** the extraction runs
- **THEN** the emitted benefit has `value: 15` and `displayValue: null`

#### Scenario: A non-monetary string value becomes a null value with display text

- **GIVEN** the World of Hyatt `Free Night Award` row with `value: "Cat 1-4"` and no
  `monetaryValue`
- **WHEN** the extraction runs
- **THEN** the emitted benefit has `value: null` and `displayValue: "Cat 1-4"`

#### Scenario: All five non-numeric rows are handled identically

- **GIVEN** the five source rows with string values — Marriott Bonvoy Brilliant
  "Up to 85k pts", World of Hyatt "Cat 1-4", Ritz Carlton "Up to 100k pts", Ritz Carlton
  "3 Certificates", Atmos Rewards Summit "25,000 pts"
- **WHEN** the extraction runs
- **THEN** each emits `value: null` with its original text in `displayValue`
- **AND** no numeric value is inferred or parsed out of any of those strings

---

### Requirement: Multiplier categories map through an explicit lookup table

The system SHALL map each of the 47 distinct free-text multiplier keys to one of the 14
canonical category slugs using the hardcoded table in `design.md` §5.3, and SHALL contain
no substring, prefix, or fuzzy matching.

#### Scenario: A qualified key maps to its slug and keeps its qualifier

- **GIVEN** a card with the multiplier key `Dining (US Restaurants)` at rate 4
- **WHEN** the extraction runs
- **THEN** an earn rate is emitted with `category: "dining"` and `rate: 4`
- **AND** its `notes` records `US restaurants only`

#### Scenario: An unmapped key falls to other with its text preserved

- **GIVEN** a multiplier key not present in the lookup table
- **WHEN** the extraction runs
- **THEN** the emitted earn rate has `category: "other"`
- **AND** the original key text appears verbatim in `notes`

#### Scenario: Every category in the output is in the taxonomy

- **GIVEN** the produced `data/cards.json`
- **WHEN** every `benefits[].category` and `earnRates[].category` value is collected
- **THEN** each is one of the 14 slugs declared in the file's `categories[]` array

#### Scenario: Two keys colliding on one slug keep the higher rate

- **GIVEN** one card carrying both `Dining (US)` at 4 and `Food Delivery` at 2, which both
  map to `dining`
- **WHEN** the extraction runs
- **THEN** a single `dining` earn rate is emitted at rate 4
- **AND** both original key texts appear in its `notes`

---

### Requirement: spendBenefits become spend threshold seeds

The system SHALL convert each legacy `spendBenefits` entry into a `spendThresholds` entry
of `{label, requirement, anchor}`, mapping `yearType` `"Membership Year"` to `anniversary`
and `"Calendar Year"` to `calendar`.

#### Scenario: A membership-year threshold is anniversary-anchored

- **GIVEN** the Atmos Rewards Summit entry
  `{name: "Global 100K Companion Award", spendRequired: 60000, yearType: "Membership Year"}`
- **WHEN** the extraction runs
- **THEN** a spend threshold is emitted with
  `{label: "Global 100K Companion Award", requirement: 60000, anchor: "anniversary"}`

#### Scenario: All eleven thresholds survive across nine cards

- **GIVEN** the legacy blob, in which 9 of 24 cards carry a non-empty `spendBenefits` array
  totalling 11 entries
- **WHEN** the extraction runs
- **THEN** the catalog contains 11 spend thresholds distributed across those same 9 cards
- **AND** the other 15 cards each have `spendThresholds: []`

#### Scenario: Spend thresholds do not become MSRs

- **GIVEN** a catalog card carrying spend thresholds
- **WHEN** that card is added to the wallet from the catalog
- **THEN** no MSR is created in user state
- **AND** the thresholds are available only as pre-filled suggestions in the MSR add form

---

### Requirement: Absent data is null and cap data is never invented

The system SHALL emit `null` for any field absent from the source, `caps: []` for every
card, and `anchor: "calendar"` on every extracted benefit.

#### Scenario: Every card has an empty caps array

- **GIVEN** the produced `data/cards.json`
- **WHEN** all 24 cards are inspected
- **THEN** each has `caps: []`
- **AND** no cap limit, label, or cadence appears anywhere in the file

#### Scenario: Every extracted benefit is calendar-anchored

- **GIVEN** the produced `data/cards.json`
- **WHEN** all 52 benefit definitions are inspected
- **THEN** each has `anchor: "calendar"`, because the source contains no anniversary data

---

### Requirement: The catalog file conforms to schema version 1

The system SHALL emit `data/cards.json` matching the schema in `design.md` §1, with
`schemaVersion: 1`, an `updated` date, the 14-entry `categories[]` taxonomy, and a
`cards[]` array whose members carry `slug`, `name`, `issuer`, `annualFee`, `benefits`,
`earnRates`, `caps`, and `spendThresholds`.

#### Scenario: The file validates against the documented schema

- **GIVEN** the produced `data/cards.json`
- **WHEN** `npm run validate:catalog` is run
- **THEN** it exits 0 reporting 24 cards validated
- **AND** it reports zero unknown fields and zero enum violations

#### Scenario: Slugs are unique and stable

- **GIVEN** the produced catalog
- **WHEN** the 24 `slug` values are collected
- **THEN** all 24 are distinct, lowercase, and kebab-case
- **AND** re-running the extraction produces byte-identical slugs

---

### Requirement: Adding a card from the catalog copies rather than references

The system SHALL, when a card is added from the catalog, deep-copy the card, its benefits,
its earn rates, and its caps into user state with a freshly generated UUID for every
entity; and SHALL never resolve an owned card's data by reading the catalog at runtime.

#### Scenario: Catalog add seeds benefits into user state

- **GIVEN** an empty wallet and a catalog containing Amex Platinum with 3 benefits
- **WHEN** the user adds Amex Platinum from the catalog sheet
- **THEN** user state gains one card and 3 benefits, each with its own UUID
- **AND** the card's `slug` is retained as provenance only

#### Scenario: Editing a seeded benefit does not write back to the catalog

- **GIVEN** a card added from the catalog
- **WHEN** the user renames one of its benefits and changes its value
- **THEN** `data/cards.json` is byte-identical to before the edit
- **AND** the change is present only in user state

#### Scenario: A catalog change does not alter an already-owned card

- **GIVEN** a wallet containing a card added from the catalog
- **WHEN** `data/cards.json` is edited to change that card's annual fee and a benefit value,
  and the app is reloaded
- **THEN** the owned card still shows the values captured at the time it was added
- **AND** the new catalog values appear only if the card is added again as a second card

#### Scenario: Two adds of the same catalog card are independent

- **GIVEN** a catalog card added to the wallet twice
- **WHEN** a benefit on the first copy is deleted
- **THEN** the second copy retains all of its benefits
- **AND** no redemption keyed to the second copy's benefits is affected

---

### Requirement: Extraction is gated on invariants before the file is trusted

The system SHALL refuse to write `data/cards.json` unless all extraction invariants pass,
and SHALL print the result of each check.

#### Scenario: The row-accounting invariant passes

- **GIVEN** the legacy blob with 283 benefit rows
- **WHEN** the extraction runs
- **THEN** the report states that 283 of 283 input rows were accounted for
- **AND** no row was consumed by two groups and none was dropped

#### Scenario: Per-card annual value sums are preserved exactly

- **GIVEN** the legacy blob
- **WHEN** the extraction computes each card's total annual benefit value before collapse,
  and again after collapse by expanding each recurring definition across its periods and
  applying `valueOverrides`
- **THEN** the two sums are exactly equal for all 24 cards
- **AND** rows with a null value are excluded from both sides identically

#### Scenario: A broken invariant aborts the write

- **GIVEN** an extraction run in which a per-card sum differs before and after collapse
- **WHEN** the invariant check executes
- **THEN** the script exits non-zero naming the offending card and both sums
- **AND** `data/cards.json` is left untouched

#### Scenario: The catalog is human-reviewed before it is committed

- **GIVEN** a successful extraction run
- **WHEN** the resulting `data/cards.json` is prepared for commit
- **THEN** a human has read the diff and confirmed the 24 cards, 52 definitions, the single
  `valueOverrides` entry, and the 5 null-valued benefits
- **AND** the commit message records the invariant report
