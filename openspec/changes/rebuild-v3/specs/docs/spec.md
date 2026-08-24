# Capability: Docs

Documentation that matches the rebuilt architecture, and removal of the documentation that
no longer describes anything real.

## ADDED Requirements

### Requirement: The README describes the current architecture and workflow

The system SHALL provide a README covering the architecture, local development, testing,
deployment, and the app URL, accurate to the rebuilt system.

#### Scenario: The README covers the whole loop

- **GIVEN** the rewritten `README.md`
- **WHEN** it is read
- **THEN** it explains the client/server split, names the four tabs, documents
  `npm run dev`, `npm run build`, `npm test`, `npm run validate:catalog`, and
  `npm run deploy`, and gives the app URL

#### Scenario: The README documents the server setup

- **GIVEN** the README
- **WHEN** the deployment section is read
- **THEN** it covers the virtualenv, the SQL migration and how to apply it, the start
  script, the launchd agent, the `tailscale serve` command, and the health check entry

#### Scenario: The README names no dead technology

- **GIVEN** the README
- **WHEN** it is searched for Firebase, localStorage as a data store, or the legacy
  single-file workflow
- **THEN** no match is found

#### Scenario: A fresh clone can build and deploy from the README alone

- **GIVEN** a fresh clone of the repository and a reader who has not seen the plan or the
  spec
- **WHEN** they follow the README from top to bottom
- **THEN** they can install dependencies, run the tests, produce a build, and deploy
- **AND** they need no undocumented step and no tribal knowledge

---

### Requirement: The agent instruction files describe the new codebase

The system SHALL rewrite `CLAUDE.md` and `AGENTS.md` to describe the rebuilt architecture,
its layering rules, and its conventions.

#### Scenario: The agent files match the code

- **GIVEN** the rewritten `CLAUDE.md` and `AGENTS.md`
- **WHEN** they are read against the source tree
- **THEN** they describe the `src/engine`, `src/state`, `src/storage`, `src/catalog`, and
  `src/ui` layering, the build and test commands, and the server layout
- **AND** they no longer describe a single-file app, `INITIAL_CARD_DATABASE`, `resolveCard`,
  or the legacy localStorage keys

#### Scenario: The layering rule is stated where an agent will see it

- **GIVEN** `CLAUDE.md`
- **WHEN** the architecture section is read
- **THEN** it states that the engine and selectors are React-free, the store is HTTP-free,
  and only `src/storage/` may speak to the API

#### Scenario: The beads workflow block is preserved

- **GIVEN** the rewritten files
- **WHEN** the task-tracking section is read
- **THEN** the `bd` workflow guidance is retained
- **AND** the surrounding content is updated to the new architecture

---

### Requirement: Stale documentation is deleted

The system SHALL remove the documentation files that describe the pre-rebuild app.

#### Scenario: The Firebase-era documents are gone

- **GIVEN** the repository after the docs phase
- **WHEN** the root and `docs/` are listed
- **THEN** `FEATURES.md`, `FEATURES_DETAILED.md`, `INSTALLATION.md`, `QUICKSTART.md`,
  `USER_GUIDE.md`, `CHANGELOG.md`, and `docs/plans/` are absent

#### Scenario: The surviving documents are the intended set

- **GIVEN** the repository after the docs phase
- **WHEN** its markdown files are listed
- **THEN** they are `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `docs/card-schema.md`, and the `openspec/` tree
- **AND** nothing references a deleted file

#### Scenario: No link points at a removed document

- **GIVEN** the surviving documentation
- **WHEN** its internal links are followed
- **THEN** each resolves
- **AND** no link targets a deleted file
