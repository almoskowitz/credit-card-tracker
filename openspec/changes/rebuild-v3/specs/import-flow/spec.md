# Capability: Import Flow

Getting a new card or benefit into the app must be trivially easy — this is the top ask.
One documented schema, three tiers of entry, plus whole-state export and import as the
escape hatch.

## ADDED Requirements

### Requirement: One documented schema is the single source of truth

The system SHALL document the import format in `docs/card-schema.md` with an annotated
example, a field reference, and a copy-paste LLM prompt block, and SHALL keep the
importer's validation consistent with it.

#### Scenario: The document carries an annotated example

- **GIVEN** `docs/card-schema.md`
- **WHEN** it is read
- **THEN** it contains a complete example card with every field annotated, including a
  benefit with `valueOverrides` and a benefit with a null value and a display string

#### Scenario: The document carries a field reference

- **GIVEN** the document
- **WHEN** the field table is read
- **THEN** each field lists its type, whether it is required, its enum values where
  applicable, and what `null` means for it

#### Scenario: The LLM prompt block is copy-paste ready

- **GIVEN** the document
- **WHEN** the prompt block is copied into a chat window along with a card's benefits page
- **THEN** the prompt instructs the model to use `null` rather than guess amounts, names
  the four cadences, the two anchors, and the 14 categories, and asks for JSON only
- **AND** the output it produces is accepted by the in-app paste importer without editing

#### Scenario: Validation messages agree with the document

- **GIVEN** the importer's error messages
- **WHEN** they are compared against the field reference
- **THEN** the field names, enum values, and requirements match exactly

---

### Requirement: The catalog file can be edited and validated directly

The system SHALL provide `npm run validate:catalog`, a schema check over `data/cards.json`
runnable without the app.

#### Scenario: A valid catalog passes

- **GIVEN** the committed `data/cards.json`
- **WHEN** `npm run validate:catalog` is run
- **THEN** it exits 0 reporting 24 cards validated

#### Scenario: An invalid cadence is caught with its path

- **GIVEN** a hand-edit setting a benefit's cadence to `"yearly"`
- **WHEN** validation is run
- **THEN** it exits non-zero
- **AND** the message names the card slug and the path, for example
  `cards[3].benefits[2].cadence must be monthly|quarterly|semiannual|annual`

#### Scenario: An unknown category is caught

- **GIVEN** a hand-edit setting a benefit's category to a slug not in the taxonomy
- **WHEN** validation is run
- **THEN** it fails naming the offending value and listing the 14 valid slugs

#### Scenario: The tier-one loop is documented end to end

- **GIVEN** `docs/card-schema.md`
- **WHEN** the tier-one instructions are followed
- **THEN** they are: edit `data/cards.json`, run `npm run validate:catalog`, run
  `npm run deploy`

---

### Requirement: JSON can be pasted into the app

The system SHALL accept pasted JSON in the catalog sheet, accepting either a full catalog
card or a bare benefit, previewing what will be added before anything is written.

#### Scenario: A pasted card is previewed then added

- **GIVEN** the paste view with a valid card object
- **WHEN** the user pastes and submits
- **THEN** a preview lists the card name, fee, and each benefit with cadence and value
- **AND** confirming copies it into user state with fresh UUIDs under the active profile

#### Scenario: A bare benefit is added to the open card

- **GIVEN** a card detail sheet open on a specific card
- **WHEN** the user pastes a single benefit object
- **THEN** it is previewed and, on confirm, added to that card
- **AND** it is not treated as a new card

#### Scenario: Nothing is written until the preview is confirmed

- **GIVEN** a valid paste that has been previewed
- **WHEN** the user dismisses the sheet instead of confirming
- **THEN** no state change occurred and no `PUT` was issued

---

### Requirement: Import errors are precise and actionable

The system SHALL report validation failures with the exact path and the accepted values,
and SHALL report every error found rather than only the first.

#### Scenario: A bad cadence names the path and the options

- **GIVEN** a pasted card whose third benefit has `cadence: "biannual"`
- **WHEN** it is validated
- **THEN** the error reads
  `benefits[2].cadence must be monthly|quarterly|semiannual|annual`

#### Scenario: Malformed JSON is distinguished from invalid data

- **GIVEN** text with a trailing comma
- **WHEN** it is submitted
- **THEN** the error identifies it as a JSON parse failure with the position
- **AND** it is not reported as a schema violation

#### Scenario: Multiple errors are all reported

- **GIVEN** a paste with a bad cadence, an unknown category, and a missing benefit name
- **WHEN** it is validated
- **THEN** all three are listed with their paths

#### Scenario: An unknown field is rejected rather than dropped

- **GIVEN** a paste containing a field not in the schema
- **WHEN** it is validated
- **THEN** the field is reported by path as unrecognized
- **AND** it is not silently discarded, since it usually means a typo in a real field name

---

### Requirement: Blank forms cover one-off entries

The system SHALL provide minimal in-app forms to create a card or a benefit from scratch,
without JSON.

#### Scenario: A card is created from a blank form

- **GIVEN** the catalog sheet
- **WHEN** the user chooses the blank form and enters a name, issuer, and fee
- **THEN** a card is created in the active profile with no benefits
- **AND** it appears in the wallet immediately

#### Scenario: Enum fields are pickers, not free text

- **GIVEN** the blank benefit form
- **WHEN** cadence, anchor, and category are entered
- **THEN** each is a picker constrained to its valid values
- **AND** an invalid combination cannot be produced

---

### Requirement: The whole state can be exported

The system SHALL export the complete state blob as a JSON file from Settings.

#### Scenario: Export produces a complete file

- **GIVEN** a populated state
- **WHEN** the user exports
- **THEN** a JSON file downloads containing all ten collections and `schemaVersion: 2`
- **AND** its filename carries the current date

#### Scenario: Export works while the service is unreachable

- **GIVEN** the unreachable state with data already loaded
- **WHEN** the user exports
- **THEN** the file is produced from the in-memory state
- **AND** the escape hatch remains available exactly when it is most needed

---

### Requirement: Import restores a whole state behind a confirmation

The system SHALL validate an imported file, show what will be replaced, require explicit
confirmation, and then replace the entire blob in a single write.

#### Scenario: Export then import restores an identical state

- **GIVEN** a populated state exported to a file
- **WHEN** that file is imported and confirmed
- **THEN** the resulting state is deeply equal to the exported state, including every id,
  redemption key, and amount
- **AND** a subsequent export produces a byte-identical file

#### Scenario: The confirm sheet states the consequence

- **GIVEN** a valid file staged for import over an existing state of 8 cards
- **WHEN** the confirm sheet is shown
- **THEN** it states that all current data will be replaced and summarizes the incoming
  file's card, benefit, and redemption counts
- **AND** nothing is written until the user confirms

#### Scenario: An invalid file is rejected before anything is replaced

- **GIVEN** a file that is not a valid v2 state blob
- **WHEN** it is selected
- **THEN** the error is shown and no confirm sheet appears
- **AND** current state is untouched

#### Scenario: Import is one atomic write

- **GIVEN** a confirmed import
- **WHEN** the network activity is observed
- **THEN** exactly one `PUT /api/state` carries the whole new blob
- **AND** no partial or per-entity writes occur

#### Scenario: A stale import is refused by the server guard

- **GIVEN** a client whose `updatedAt` is stale
- **WHEN** an import is confirmed
- **THEN** the server returns 409, local state is replaced with the server's, and the toast
  is shown
- **AND** the user can re-attempt the import against the refreshed state
