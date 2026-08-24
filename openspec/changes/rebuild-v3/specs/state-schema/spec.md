# Capability: State Schema

The shape of user data — the v2 blob — and the rules that govern identity, redemption
recording, profile scoping, and first-boot initialization.

## ADDED Requirements

### Requirement: User state conforms to the v2 blob shape

The system SHALL represent all user data as a single JSON object carrying
`schemaVersion: 2` and exactly the ten collections defined in `design.md` §2: `profiles`,
`cards`, `benefits`, `redemptions`, `caps`, `msrs`, `categories`, `spend`, `earnRates`.

#### Scenario: A round-tripped blob keeps every collection

- **GIVEN** a populated state blob
- **WHEN** it is serialized to JSON, sent to the server, read back, and parsed
- **THEN** all ten top-level keys are present with identical contents
- **AND** `schemaVersion` is the number 2

#### Scenario: Entity relationships are by id

- **GIVEN** a state blob containing cards and benefits
- **WHEN** the relationships are inspected
- **THEN** every `benefit.cardId`, `cap.cardId`, `msr.cardId`, and `earnRate.cardId`
  matches the `id` of a card in `cards`
- **AND** every `card.profileId` matches the `id` of a profile in `profiles`
- **AND** no entity is nested inside another

#### Scenario: Deleting a card removes its dependents

- **GIVEN** a card with 3 benefits, 1 MSR, 2 earn rates, and redemptions against its
  benefits
- **WHEN** the card is deleted
- **THEN** those benefits, the MSR, the earn rates, and every redemption keyed to those
  benefit ids are removed in the same reducer action
- **AND** no orphaned row remains in any collection

---

### Requirement: Every entity is identified by a freshly generated UUID

The system SHALL assign a UUID to every card, benefit, cap, MSR, category, earn rate, and
profile at creation, and SHALL NOT key any persistent record by array index or by name.

#### Scenario: Redemption history survives a benefit list edit

- **GIVEN** a card with benefits A, B, and C, where B has been redeemed this period
- **WHEN** benefit A is deleted and a new benefit D is added
- **THEN** B's redemption is still recorded and still displays as redeemed
- **AND** neither C nor D appears redeemed

#### Scenario: Ids are unique across a populated blob

- **GIVEN** a state blob with at least 10 cards and 50 benefits
- **WHEN** all `id` values across all collections are collected
- **THEN** there are no duplicates

---

### Requirement: Redemptions record amounts keyed by benefit and period

The system SHALL store redemptions as a flat map from `"<benefitId>|<periodKey>"` to a
numeric amount, where an absent key means not redeemed.

#### Scenario: One tap logs the full resolved period value

- **GIVEN** a monthly benefit resolving to $15 for the current window
- **WHEN** the user taps its runway toggle once
- **THEN** the redemptions map gains one entry with the value 15
- **AND** the key is the benefit's id joined to the current period key by a pipe

#### Scenario: Tapping again removes the entry

- **GIVEN** a redeemed benefit
- **WHEN** the user taps its toggle a second time
- **THEN** the redemptions key is deleted from the map
- **AND** it is not set to 0, false, or null

#### Scenario: A partial amount is a distinct legal value

- **GIVEN** a benefit resolving to $50 that the user only used $18 of
- **WHEN** the amount is edited to 18 in the card detail sheet
- **THEN** the redemption entry holds 18
- **AND** break-even counts 18 toward recovery, not 50

#### Scenario: Zero is a legal redemption amount

- **GIVEN** a benefit the user marked used but recovered nothing from
- **WHEN** its amount is edited to 0
- **THEN** the key remains present with value 0
- **AND** the benefit renders as redeemed while contributing 0 to recovery
- **AND** it is distinguishable from a benefit that was never redeemed

#### Scenario: Redemptions in different periods coexist

- **GIVEN** a monthly benefit redeemed in each of three consecutive months
- **WHEN** the redemptions map is inspected
- **THEN** it holds three entries with the same benefit id and three different period keys
- **AND** each contributes independently to the year's recovery total

---

### Requirement: Profiles scope cards as a filter

The system SHALL associate each card with exactly one profile via `profileId`, and SHALL
filter all views by the active profile.

#### Scenario: Views show only the active profile's cards

- **GIVEN** a Personal profile with 4 cards and a Business profile with 3
- **WHEN** Personal is active
- **THEN** Today, Wallet, and Insights show only those 4 cards and their benefits, MSRs,
  and totals

#### Scenario: The active profile is not part of the synced blob

- **GIVEN** two devices viewing the same state
- **WHEN** one switches to the Business profile
- **THEN** the other device's active profile is unchanged after it refreshes
- **AND** `activeProfileId` does not appear anywhere in the state blob

#### Scenario: Deleting a profile requires resolving its cards

- **GIVEN** a profile holding cards
- **WHEN** deletion is attempted
- **THEN** the app requires the cards to be reassigned or deleted first
- **AND** no card is left with a `profileId` that matches no profile

---

### Requirement: Per-device view preferences live outside the blob

The system SHALL persist the active profile id and the last selected tab in `localStorage`,
and SHALL persist no user data there.

#### Scenario: The last tab is restored on the same device

- **GIVEN** a user last viewing the Insights tab
- **WHEN** the app is reopened on that device
- **THEN** Insights is selected

#### Scenario: localStorage holds no card, benefit, or redemption data

- **GIVEN** an app that has been used to add cards and log redemptions
- **WHEN** `localStorage` is enumerated
- **THEN** the only keys present relate to view preferences
- **AND** clearing `localStorage` loses no user data — it reloads identically after a
  refresh

---

### Requirement: First boot initializes a default state

The system SHALL, when `GET /api/state` returns `{updatedAt: null, state: null}`, construct
a default state locally and persist it on the first mutation.

#### Scenario: An empty server yields a usable app

- **GIVEN** a server with no `card-tracker` row
- **WHEN** the client loads
- **THEN** it constructs a state with `schemaVersion: 2`, one profile named "Personal", the
  14 seeded spend categories, and every other collection empty
- **AND** the app renders the Today tab with an empty-state message rather than an error

#### Scenario: The default state is not written until something changes

- **GIVEN** a first boot against an empty server
- **WHEN** the user loads the app and makes no change
- **THEN** no `PUT /api/state` is issued
- **AND** the server row is still absent

#### Scenario: The first mutation inserts the row

- **GIVEN** a first boot against an empty server
- **WHEN** the user adds their first card
- **THEN** a `PUT` is issued carrying `updatedAt: null`
- **AND** the server inserts the row and returns 200 with a new `updatedAt`

---

### Requirement: There is no migration path and no version negotiation

The system SHALL support only `schemaVersion: 2`, SHALL contain no `migrate()` function, no
v1 reader, and no seed-once guard.

#### Scenario: No migration code exists

- **GIVEN** the completed `src/` tree
- **WHEN** it is searched for migration logic
- **THEN** there is no function that reads a v1 shape, no `schemaVersion: 1` branch in the
  client, and no reference to the legacy localStorage keys `profiles`, `cards`,
  `card-database`, `used-benefits`, or `annual-spending`

#### Scenario: A blob of an unexpected version is refused, not converted

- **GIVEN** a state blob whose `schemaVersion` is not 2
- **WHEN** the client loads it
- **THEN** it shows an explicit error naming the version found and the version expected
- **AND** it does not attempt a conversion and does not overwrite the server row
