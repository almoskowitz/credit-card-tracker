# Capability: Storage & Sync

The client side of persistence: the `load()` / `save()` shim, debouncing, flush on
backgrounding, 409 recovery, the explicit unreachable state, and the store layering that
keeps all of it out of the UI.

## ADDED Requirements

### Requirement: The storage shim exposes load, save, and flush

The system SHALL provide `src/storage/api.ts` exporting `load()`, `save(state)`, and
`flush()`, and SHALL keep every HTTP detail behind that interface.

#### Scenario: Nothing above the shim knows about HTTP

- **GIVEN** the files under `src/state/` and `src/ui/`
- **WHEN** they are searched for `fetch`, `XMLHttpRequest`, `/api/`, or a status code
  literal
- **THEN** no match is found outside `src/storage/`

#### Scenario: The shim knows nothing about React

- **GIVEN** `src/storage/api.ts`
- **WHEN** its imports are inspected
- **THEN** it does not import React or any component

---

### Requirement: Writes are debounced

The system SHALL coalesce state changes and issue at most one `PUT` per 750 ms of quiet.

#### Scenario: Rapid typing produces one write

- **GIVEN** the spend entry field
- **WHEN** the user types six digits within two seconds
- **THEN** exactly one `PUT /api/state` is issued, after the typing stops
- **AND** it carries the final value

#### Scenario: Sustained editing still eventually writes

- **GIVEN** a user making an edit every 500 ms for 10 seconds
- **WHEN** the editing stops
- **THEN** a `PUT` carrying the final state is issued within 750 ms
- **AND** no state change is lost

---

### Requirement: Pending writes are flushed when the app is backgrounded

The system SHALL issue any pending write immediately on `visibilitychange` to `hidden` and
on `pagehide`, using `fetch` with `keepalive: true`.

#### Scenario: Backgrounding mid-edit does not lose the edit

- **GIVEN** an edit made 200 ms ago with the debounce timer still pending
- **WHEN** the tab is backgrounded
- **THEN** the `PUT` is issued immediately rather than waiting for the timer
- **AND** it is sent with `keepalive: true` so it survives the page being frozen

#### Scenario: The real-device case is verified

- **GIVEN** the app open on an iPhone with an uncommitted edit
- **WHEN** the user swipes to the home screen and then reopens the app
- **THEN** the edit is present
- **AND** it is present on a second device after a refresh

#### Scenario: Flush with nothing pending is a no-op

- **GIVEN** no pending write
- **WHEN** the tab is backgrounded
- **THEN** no request is issued

---

### Requirement: The client re-reads state when it returns to the foreground

The system SHALL re-issue `GET /api/state` on `visibilitychange` to `visible`, and SHALL
adopt the server state when it is newer and no local write is pending.

#### Scenario: A phone edit appears on the laptop

- **GIVEN** the app open on a laptop and an edit made on the phone
- **WHEN** the laptop tab is refreshed
- **THEN** the phone's edit is visible

#### Scenario: A laptop edit appears on the phone

- **GIVEN** the app open on a phone, backgrounded, and an edit made on the laptop
- **WHEN** the phone app is brought to the foreground
- **THEN** the foreground `GET` returns a newer `updatedAt`, local state is replaced, and
  the laptop's edit is visible without a manual refresh

#### Scenario: A pending local write is not clobbered by the foreground read

- **GIVEN** a pending local write and a foreground event
- **WHEN** the `GET` returns
- **THEN** local state is not replaced
- **AND** the pending write proceeds and is resolved by the normal 200-or-409 path

---

### Requirement: A 409 replaces local state and tells the user

The system SHALL, on receiving 409 from a `PUT`, replace local state with the server state
carried in the response, adopt its `updatedAt`, show the toast **"Refreshed — your view was
out of date"**, and SHALL NOT retry the rejected write.

#### Scenario: A stale tab refreshes instead of clobbering

- **GIVEN** a tab left open since yesterday holding stale state
- **AND** edits made from another device since
- **WHEN** the stale tab attempts a write
- **THEN** the server returns 409 and the tab's view is replaced with the current state
- **AND** the toast is shown
- **AND** the other device's edits are intact

#### Scenario: The rejected change is not silently re-applied

- **GIVEN** a write rejected with 409
- **WHEN** the client has adopted the server state
- **THEN** no follow-up `PUT` re-submitting the rejected change is issued
- **AND** the app does not enter a retry loop

#### Scenario: The user is left on the same screen

- **GIVEN** a 409 while the user is on the Wallet tab with a card detail sheet open
- **WHEN** state is replaced
- **THEN** the tab and sheet remain open showing refreshed data
- **AND** the app does not reload the page or reset to Today

---

### Requirement: An unreachable service is explicit and blocks mutations

The system SHALL, when the service cannot be reached, display a persistent banner, block
every mutation at the reducer boundary, retry with exponential backoff capped at 30
seconds, and offer a manual retry.

#### Scenario: Killing the service produces an explicit state

- **GIVEN** the app loaded and working
- **WHEN** the service is stopped
- **THEN** the next write fails and a persistent banner states the service is unreachable
- **AND** the connection dot in the Today header shows the disconnected state

#### Scenario: Mutations are refused while unreachable

- **GIVEN** the unreachable state
- **WHEN** the user taps a redemption toggle, edits a benefit, or logs MSR spend
- **THEN** no state change is applied
- **AND** the user is told why rather than seeing the action silently do nothing

#### Scenario: The block is enforced in the reducer, not in components

- **GIVEN** the store implementation
- **WHEN** the mutation guard is located
- **THEN** it is a single check at the reducer boundary that rejects every mutating action
- **AND** it cannot be bypassed by a component that does not check connection state

#### Scenario: Reading remains available

- **GIVEN** the unreachable state
- **WHEN** the user navigates between tabs and opens a card
- **THEN** the last-loaded data is still displayed
- **AND** navigation is not blocked

#### Scenario: Recovery clears the state automatically

- **GIVEN** the unreachable state with backoff running
- **WHEN** the service comes back
- **THEN** the next retry succeeds, state is re-read, the banner clears, and mutations are
  re-enabled
- **AND** the user does not have to reload the page

#### Scenario: Manual retry short-circuits the backoff

- **GIVEN** the unreachable state with a 30-second backoff pending
- **WHEN** the user taps Retry
- **THEN** an attempt is made immediately
- **AND** on failure the backoff resumes

---

### Requirement: There is no local data fallback

The system SHALL NOT write user data to `localStorage`, `sessionStorage`, IndexedDB, or any
local queue, and SHALL NOT accept a mutation that cannot reach the server.

#### Scenario: No queued writes exist after an outage

- **GIVEN** an outage during which the user attempted several edits
- **WHEN** the service returns
- **THEN** no queued mutations are replayed
- **AND** the state matches what the server holds

#### Scenario: Client storage holds no user data

- **GIVEN** an actively used app
- **WHEN** all browser storage is enumerated
- **THEN** only view preferences are present
- **AND** no card, benefit, redemption, MSR, or spend value is found

---

### Requirement: The store is a pure reducer under React context

The system SHALL implement state as a React context over `useReducer` with a pure reducer,
and SHALL keep selectors and the engine free of React.

#### Scenario: The reducer is a pure function

- **GIVEN** `src/state/store.tsx`
- **WHEN** the reducer body is inspected
- **THEN** it performs no I/O, reads no clock or random source directly, and mutates no
  input
- **AND** any timestamp or id needed by an action is supplied in the action payload

#### Scenario: Selectors are testable without a renderer

- **GIVEN** `tests/selectors.test.ts`
- **WHEN** it is run
- **THEN** selectors are exercised against plain state objects
- **AND** no component is rendered and no context provider is mounted

#### Scenario: Saving is driven by state change, not by call sites

- **GIVEN** any mutation dispatched from anywhere in the UI
- **WHEN** the state changes
- **THEN** `save()` is invoked by a single subscription to state
- **AND** no component calls `save()` directly
