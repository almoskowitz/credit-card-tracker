# Capability: State Service

The FastAPI service on the Mac Studio that owns the single state row, serves the client
same-origin, and refuses stale writes.

## ADDED Requirements

### Requirement: State is stored in one Postgres row

The system SHALL persist state in an `app_state` table in the `sovereign_ai` database,
under the primary key `'card-tracker'`, created by a hand-applied migration file following
the house naming convention.

#### Scenario: The migration creates the table

- **GIVEN** a `sovereign_ai` database without an `app_state` table
- **WHEN** `llm-infrastructure/scripts/pg_migrate_20260824_card_tracker.sql` is applied via
  `docker exec`
- **THEN** `app_state(key text primary key, value jsonb not null, updated_at timestamptz not null default now())` exists
- **AND** re-applying the migration is safe and does not error

#### Scenario: The row is covered by the existing backup

- **GIVEN** the table living in `sovereign_ai`
- **WHEN** the nightly `pg_dump` runs
- **THEN** the `app_state` row is included
- **AND** no new backup job was added

---

### Requirement: Health reflects database reachability

The system SHALL expose `GET /api/health` which executes a trivial query against the
database and returns 200 only when that query succeeds.

#### Scenario: Health is green when the database answers

- **GIVEN** a running service with a reachable database
- **WHEN** `GET /api/health` is called
- **THEN** it returns 200

#### Scenario: Health is not green when the database is gone

- **GIVEN** a running service whose database container has been stopped
- **WHEN** `GET /api/health` is called
- **THEN** it does not return 200
- **AND** the failure is visible to `health_check.sh`

---

### Requirement: GET returns the state and its version token

The system SHALL expose `GET /api/state` returning `{updatedAt, state}`, with both `null`
when no row exists.

#### Scenario: An empty server reports null

- **GIVEN** no `card-tracker` row
- **WHEN** `GET /api/state` is called
- **THEN** it returns 200 with `{"updatedAt": null, "state": null}`

#### Scenario: A populated server returns the blob and its timestamp

- **GIVEN** a stored state row
- **WHEN** `GET /api/state` is called
- **THEN** it returns the stored `value` as `state`
- **AND** `updatedAt` is the row's `updated_at` serialized as an ISO 8601 string

---

### Requirement: PUT applies optimistic concurrency in a single statement

The system SHALL guard writes with a conditional update that compares and writes atomically:

```sql
UPDATE app_state
   SET value = $2, updated_at = now()
 WHERE key = 'card-tracker'
   AND updated_at = $1
RETURNING updated_at;
```

and SHALL NOT read the current row and then write it in separate statements.

#### Scenario: A current write succeeds

- **GIVEN** a stored row whose `updated_at` is T1
- **WHEN** `PUT /api/state` is called with `updatedAt: T1` and a new state
- **THEN** it returns 200 with a new `updatedAt` later than T1
- **AND** the stored `value` is the submitted state

#### Scenario: Concurrent writes cannot interleave

- **GIVEN** two clients both holding `updatedAt: T1`
- **WHEN** both issue a `PUT` simultaneously
- **THEN** exactly one receives 200 and the other receives 409
- **AND** the stored state is entirely one client's blob, never a mixture

---

### Requirement: A stale write is refused with the current state

The system SHALL return `409` together with the server's current `updatedAt` and `state`
whenever the submitted `updatedAt` does not identify the current row.

#### Scenario: A stale token is rejected and the caller is told the truth

- **GIVEN** a stored row at T2, and a client still holding T1
- **WHEN** the client issues `PUT /api/state` with `updatedAt: T1`
- **THEN** the response is 409
- **AND** the body carries the current `updatedAt` T2 and the full current `state`
- **AND** the stored row is unchanged

#### Scenario: A null token against an existing row is rejected

- **GIVEN** a stored row
- **WHEN** a client that believes the server is empty issues `PUT` with `updatedAt: null`
- **THEN** the response is 409 with the current `updatedAt` and `state`
- **AND** the existing row is not overwritten

#### Scenario: A non-null token against a missing row is rejected

- **GIVEN** no stored row
- **WHEN** a client issues `PUT` with a non-null `updatedAt`
- **THEN** the response is 409 with `updatedAt: null` and `state: null`
- **AND** no row is created

---

### Requirement: The first write inserts the row

The system SHALL insert a new row when the submitted `updatedAt` is `null` and no row
exists.

#### Scenario: First write creates the row

- **GIVEN** no stored row
- **WHEN** `PUT /api/state` is called with `updatedAt: null` and a valid state
- **THEN** it returns 200 with the new `updatedAt`
- **AND** a subsequent `GET` returns that state and that timestamp

---

### Requirement: Version tokens are compared as exact strings

The system SHALL treat `updatedAt` as an opaque string throughout, serializing the column
to ISO 8601 once and comparing that same representation, and SHALL NOT parse it into a
date object on either side.

#### Scenario: Sub-second precision survives a round trip

- **GIVEN** a row whose `updated_at` carries microsecond precision
- **WHEN** the client `GET`s it and immediately `PUT`s it back unchanged
- **THEN** the write succeeds
- **AND** it does not fail because of precision lost in parsing and re-formatting

#### Scenario: The client never constructs a version token

- **GIVEN** the client source
- **WHEN** it is inspected for handling of `updatedAt`
- **THEN** the value is only ever stored and echoed
- **AND** it is never passed to `new Date()`, formatted, or compared with an inequality

---

### Requirement: The client is served same-origin from the service

The system SHALL mount the built client as static files at the root path, after the API
routes, and SHALL serve `index.html` with `Cache-Control: no-cache`.

#### Scenario: The app loads from the root

- **GIVEN** a deployed build in `server/static/`
- **WHEN** the app URL is opened
- **THEN** the client is served and reaches `/api/state` on the same origin
- **AND** no CORS headers are required or present

#### Scenario: API routes are not shadowed by the static mount

- **GIVEN** the service running with the static mount at `/`
- **WHEN** `GET /api/health` and `GET /api/state` are called
- **THEN** both reach the API handlers
- **AND** neither returns the client HTML

#### Scenario: A redeployed client is picked up on refresh

- **GIVEN** a browser holding a previously loaded page
- **WHEN** a new build is copied into `server/static/` and the page is refreshed
- **THEN** the new client loads
- **AND** the response for `index.html` carries `Cache-Control: no-cache`

---

### Requirement: The service is bound to loopback with no auth surface

The system SHALL bind `127.0.0.1:8101`, SHALL disable the interactive API docs, and SHALL
implement no application-level authentication.

#### Scenario: The port is not reachable off-host except through Tailscale

- **GIVEN** the running service
- **WHEN** a connection to port 8101 is attempted from another machine on the LAN
- **THEN** it is refused
- **AND** the same request through `https://<your-machine>.<your-tailnet>.ts.net:8443/`
  succeeds from a tailnet device

#### Scenario: Docs endpoints are absent

- **GIVEN** the running service
- **WHEN** `/docs`, `/redoc`, and `/openapi.json` are requested
- **THEN** each returns 404

---

### Requirement: The service uses the house database access pattern

The system SHALL create an asyncpg pool in the FastAPI lifespan handler and use raw SQL,
following `~/projects/house-assistant/auth/db.py` and its wiring in
`house-assistant/app.py`, reading credentials from the environment.

#### Scenario: The pool is created once and closed on shutdown

- **GIVEN** the service starting
- **WHEN** the lifespan handler runs
- **THEN** one asyncpg pool is created before requests are served and closed on shutdown
- **AND** no per-request connection is opened

#### Scenario: No credentials are present in the repository

- **GIVEN** the `server/` tree
- **WHEN** it is searched for a password, DSN, or connection string literal
- **THEN** none is found
- **AND** `DATABASE_URL` is read from the environment, populated by the start script from
  `llm-infrastructure/.env`

#### Scenario: No ORM is introduced

- **GIVEN** `server/requirements.txt`
- **WHEN** its contents are inspected
- **THEN** it lists FastAPI, uvicorn, and asyncpg without SQLAlchemy or any ORM
