# Design — Rebuild v3

Technical decisions, schemas, and contracts. Everything here is settled; implementation
follows it rather than re-deciding. Where a value is quoted from the master plan it is
reproduced verbatim.

---

## 0. Measured facts about the source data

These were verified by parsing `index.html:749` directly, not assumed. Implementation
should reproduce these numbers exactly; a mismatch means the extraction is wrong.

| Fact | Value |
|---|---|
| Cards | 24 |
| Benefit rows (input) | 283 — Monthly 216, Quarterly 32, Semi-Annual 18, Annual 17 |
| Benefit definitions (output, post-collapse) | 52 |
| Full-span exploded groups | 35 — 18 monthly (×12), 8 quarterly (×4), 9 semiannual (×2) |
| Partial-span groups | **0** — every exploded group is complete |
| Annual singletons | 17 |
| Groups with differing values within the group | **1** — `Amex Platinum / Uber Cash`, Jan–Nov $15, **Dec $20** |
| Rows with non-numeric `value` | 5 (all with `monetaryValue` undefined) |
| Distinct free-text multiplier keys | **47** (the master plan says 46; 47 is the measured count) |
| Cards with non-empty `spendBenefits` | 9 of 24, 11 thresholds total |
| Issuers | American Express, Chase, Capital One, Citi, Barclays, Bank of America |

Arithmetic check: `216/12 + 32/4 + 18/2 = 18 + 8 + 9 = 35` exploded groups; `35 + 17 = 52`
definitions; `216 + 32 + 18 + 17 = 283` input rows accounted for with none left over.

The five non-numeric values:

| Card | Benefit | Raw value |
|---|---|---|
| Marriott Bonvoy Brilliant | Free Night Award | `"Up to 85k pts"` |
| World of Hyatt | Free Night Award | `"Cat 1-4"` |
| Ritz Carlton Rewards Visa | Free Night Award | `"Up to 100k pts"` |
| Ritz Carlton Rewards Visa | Club Level Upgrade Certificates | `"3 Certificates"` |
| Atmos Rewards Summit | Companion Certificate | `"25,000 pts"` |

---

## 1. `data/cards.json` — catalog schema v1

Reference data only. Seed for new cards; never read live for a card the user already owns.

```json
{
  "schemaVersion": 1,
  "updated": "2026-08-23",
  "categories": [
    { "slug": "dining",          "name": "Dining" },
    { "slug": "supermarkets",    "name": "Supermarkets" },
    { "slug": "gas",             "name": "Gas Stations" },
    { "slug": "travel",          "name": "Travel" },
    { "slug": "hotels",          "name": "Hotels" },
    { "slug": "flights",         "name": "Flights" },
    { "slug": "office-supply",   "name": "Office Supply" },
    { "slug": "telecom",         "name": "Internet / Cable / Phone" },
    { "slug": "shipping",        "name": "Shipping" },
    { "slug": "drugstores",      "name": "Drugstores" },
    { "slug": "rideshare",       "name": "Rideshare" },
    { "slug": "streaming",       "name": "Streaming" },
    { "slug": "everything-else", "name": "Everything Else" },
    { "slug": "other",           "name": "Other" }
  ],
  "cards": [
    {
      "slug": "amex-platinum",
      "name": "Amex Platinum",
      "issuer": "American Express",
      "annualFee": 695,
      "benefits": [
        {
          "name": "Uber Cash",
          "value": 15,
          "displayValue": null,
          "cadence": "monthly",
          "anchor": "calendar",
          "category": "rideshare",
          "valueOverrides": { "M12": 20 }
        },
        {
          "name": "Free Night Award",
          "value": null,
          "displayValue": "Up to 85k pts",
          "cadence": "annual",
          "anchor": "calendar",
          "category": "hotels"
        }
      ],
      "earnRates": [
        { "category": "flights", "rate": 5, "notes": "AmexTravel Flights" }
      ],
      "caps": [],
      "spendThresholds": [
        { "label": "Second Free Night", "requirement": 30000, "anchor": "calendar" }
      ]
    }
  ]
}
```

### Field rules

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | `1` | Literal. Bumped only by a breaking catalog change. |
| `updated` | `"YYYY-MM-DD"` | Date the catalog data was last hand-verified. |
| `categories[]` | `{slug, name}` | The closed taxonomy. Exactly the 14 entries above. |
| `cards[].slug` | string | Kebab-case, unique, stable. Derived from `name`. |
| `cards[].annualFee` | number \| null | `null` means unknown, not zero. |
| `benefits[].value` | number \| null | Dollar value per period. `null` is legal and means "shown, excluded from dollar math". |
| `benefits[].displayValue` | string \| null | Human text when the value is not monetary. |
| `benefits[].cadence` | enum | `monthly` \| `quarterly` \| `semiannual` \| `annual` |
| `benefits[].anchor` | enum | `calendar` \| `anniversary`. **`calendar` everywhere initially** — no anniversary data exists in the source. |
| `benefits[].category` | slug | One of the 14. |
| `benefits[].valueOverrides` | object? | Optional. Keys are period suffixes (`M1`–`M12`, `Q1`–`Q4`, `H1`–`H2`), values are numbers. Omitted when empty. |
| `earnRates[]` | `{category, rate, notes}` | `notes` carries the original free-text key when it was lossy to map. |
| `caps[]` | `[]` | **Always empty.** No cap data exists in the source. Do not invent it. |
| `spendThresholds[]` | `{label, requirement, anchor}` | Seeds MSR suggestions. Does not auto-create MSRs. |

### Copy-on-add

Adding a card from the catalog **deep-copies** the card, its benefits, its earn rates, and
its caps into user state, assigning a fresh UUID to every entity. From that moment the
user's copy is independent. The app must never resolve an owned card's data by reading the
catalog, because a catalog update would then silently overwrite the user's edits. Only the
`slug` is retained on the user's card, and it is provenance only — never a live lookup key.

---

## 2. State v2 blob

Verbatim from the master plan:

```
{schemaVersion: 2, profiles[], cards[{id, profileId, slug, name, issuer, fee, anniversary,
opened, closed}], benefits[{id, cardId, name, value, displayValue, valueOverrides, cadence,
anchor, category, notes}], redemptions{"benefitId|periodKey": amount}, caps[],
msrs[{id, cardId, label, requirement, deadline, spent, bonusValue, notes}],
categories[{id, name, budget}], spend{"YYYY-MM": {categoryId: amount}}, earnRates[]}
```

Expanded, with types:

```ts
type State = {
  schemaVersion: 2
  profiles:    { id: string; name: string }[]
  cards:       { id: string; profileId: string; slug: string | null; name: string
                 issuer: string; fee: number | null
                 anniversary: string | null   // "YYYY-MM-DD"
                 opened: string | null        // "YYYY-MM-DD"
                 closed: string | null }[]    // "YYYY-MM-DD"
  benefits:    { id: string; cardId: string; name: string
                 value: number | null; displayValue: string | null
                 valueOverrides: Record<string, number> | null
                 cadence: 'monthly' | 'quarterly' | 'semiannual' | 'annual'
                 anchor: 'calendar' | 'anniversary'
                 category: string; notes: string | null }[]
  redemptions: Record<string, number>          // "<benefitId>|<periodKey>" -> amount
  caps:        { id: string; cardId: string; name: string
                 cadence: Cadence; limit: number; used: number; periodKey: string }[]
  msrs:        { id: string; cardId: string; label: string; requirement: number
                 deadline: string              // "YYYY-MM-DD"
                 spent: number; bonusValue: number | null; notes: string | null }[]
  categories:  { id: string; name: string; budget: number | null }[]
  spend:       Record<string, Record<string, number>>   // "YYYY-MM" -> categoryId -> amount
  earnRates:   { id: string; cardId: string; category: string
                 rate: number; notes: string | null }[]
}
```

### Decisions embedded in this shape

- **Every id is a UUID** (`crypto.randomUUID()`). The current app keys redemptions by array
  index, which breaks the moment a benefit list is edited.
- **Redemptions store amounts, not booleans.** One tap on the runway toggle writes the full
  resolved period value. Untapping deletes the key. A partial amount is edited in the card
  detail sheet. A key that is absent means "not redeemed"; a key with `0` means "redeemed
  for nothing" and is a distinct, legal state.
- **Profiles are a cheap filter**: one FK on `cards` plus an `activeProfileId` view pref.
  They are not an identity or security boundary.
- **`categories` in state** is the user's spend-budget list and is seeded from the catalog
  taxonomy on first boot. It is separate from a benefit's `category` slug.
- **Per-device view preferences** — `activeProfileId` and the last-selected tab — live in
  `localStorage`, **not** in the blob. They are view state, not data, and they legitimately
  differ between the phone and the laptop.
- **No `_open`, no `schemaVersion: 1` reader, no `migrate()`.** There is no migration.
- **First boot**: `GET /api/state` returns `{updatedAt: null, state: null}` and the client
  constructs `defaultState()` — schemaVersion 2, one profile named "Personal", the 14
  seeded categories, and every other collection empty.

---

## 3. API contract

Single user, one blob, last write wins, guarded. No per-entity routes.

```
GET  /api/health   -> 200 {"ok": true}
GET  /api/state    -> 200 { updatedAt: string | null, state: State | null }
PUT  /api/state    <- { updatedAt: string | null, state: State }
                   -> 200 { updatedAt: string }
                   -> 409 { updatedAt: string, state: State }   // current server state
```

### Table

```sql
create table app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
```

Migration file: `llm-infrastructure/scripts/pg_migrate_20260824_card_tracker.sql`, in
database `sovereign_ai`, applied by hand via `docker exec`. `sovereign_ai` is already
covered by the nightly `pg_dump`, which satisfies the handoff's backup requirement without
new machinery.

The row key is the literal string `'card-tracker'`.

### Optimistic concurrency — the exact statement

`PUT` performs its check and its write in **one statement**, so there is no read-then-write
race:

```sql
UPDATE app_state
   SET value = $2, updated_at = now()
 WHERE key = 'card-tracker'
   AND updated_at = $1
RETURNING updated_at;
```

Dispatch on the result:

| Request `updatedAt` | Statement result | Row exists? | Response |
|---|---|---|---|
| non-null | 1 row | — | `200 {updatedAt: <returned>}` |
| non-null | 0 rows | yes | `409 {updatedAt, state}` — the caller is stale |
| non-null | 0 rows | no | `409 {updatedAt: null, state: null}` — row was deleted under the caller |
| null | — | no | `INSERT ... RETURNING updated_at` → `200` |
| null | — | yes | `409 {updatedAt, state}` — the caller thinks it is first, it is not |

**`updatedAt` is compared as the exact ISO string it was handed out as. Never parse it into
a date on either side.** Round-tripping a `timestamptz` through parsing loses sub-microsecond
precision and turns the guard into a coin flip. The server serialises `updated_at` to ISO
8601 once and both comparisons use that string.

`$1` is bound as `timestamptz` by casting the string in SQL (`$1::timestamptz`); the
equality is exact because the string came from this same column.

### Server shape

- FastAPI, `docs_url=None` and `redoc_url=None` — nothing on the tailnet needs Swagger.
- **No CORS middleware.** The client is served from the same origin.
- asyncpg pool created in the lifespan handler, copying
  `~/projects/house-assistant/auth/db.py` and the wiring in `house-assistant/app.py`.
- `GET /api/health` executes `SELECT 1` so it fails when the database is gone, not just
  when the process is.
- `app.mount("/", StaticFiles(directory="static", html=True))` **last**, after the API
  routes, so `/api/*` is not shadowed.
- `Cache-Control: no-cache` on `index.html` — the client is a single hashed-content file
  and a stale one is indistinguishable from a broken deploy.
- Bind `127.0.0.1` only. Never `0.0.0.0`. `tailscale serve` fronts it.

---

## 4. Period engine

Pure functions, no date library, in `src/engine/period.ts`.

```ts
const MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }
```

### Period key formats — frozen

| Anchor | Format | Example |
|---|---|---|
| `calendar` | `"YYYY-MM"` where MM is the **1-based first month of the window** | `"2026-07"` (a semiannual H2 window) |
| `anniversary` | `"A" + "YYYY-MM-DD"` of the window start, after clamping | `"A2026-07-31"` |

Redemption ledger key: `"<benefitId>|<periodKey>"` — e.g. `"a1b2…|2026-07"`.

`periodKey` is the ledger key, so **it must be stable forever**. Once a format ships,
changing it orphars every historical redemption. A snapshot test pins both formats.

### Window semantics

- **Start-inclusive, end-exclusive.** `start <= now < end`. A `now` exactly equal to
  `start` at local midnight is inside the new window; a `now` exactly equal to `end` is
  inside the *next* window.
- All dates are constructed in **local time**. There is no UTC anywhere in the engine.

### `clampDay`

`new Date(2026, 1, 31)` silently becomes March 3. Every constructed date passes through:

```ts
function clampDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()  // day 0 = last of prev month
  return new Date(year, monthIndex, Math.min(day, lastDay))
}
```

So a Jan-31 anniversary yields Feb 28 (or Feb 29 in a leap year), Apr 30, Jun 30, Sep 30,
Nov 30 — and Jan 31, Mar 31, May 31, Jul 31, Aug 31, Oct 31, Dec 31 unchanged.

### `daysLeft` — whole calendar days

`(end - now) / 86400000` returns 23- or 25-hour days across a DST boundary, so "days left"
can be off by one exactly when it matters most. Count calendar days instead:

```ts
function daysLeft(now: Date, end: Date): number {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((b - a) / 86400000)
}
```

Both endpoints are normalised to UTC midnight *of their local calendar date*, so the
subtraction never straddles a DST offset. The result is the number of whole calendar days
from today up to but not including the end date.

### `periodFor(benefit, card, now)`

```ts
function periodFor(benefit, card, now = new Date()): { start: Date; end: Date; key: string }
```

**Anniversary anchor** — used when `benefit.anchor === 'anniversary'` *and*
`card?.anniversary` is a parseable date. Otherwise it falls through to the calendar branch
and **never throws**.

```
span      = MONTHS[benefit.cadence]
a         = parse(card.anniversary + "T00:00:00")     // local midnight
anniDay   = a.getDate()

months    = (now.getFullYear() - a.getFullYear()) * 12 + (now.getMonth() - a.getMonth())

// CORRECTION to the handoff sketch. The naive test is `now.getDate() < a.getDate()`,
// which is wrong when the anniversary day does not exist in the current month: a Jan-31
// anniversary in February must roll over on Feb 28, not wait for a Feb 31 that never
// arrives. Compare against the day clamped INTO THE CURRENT MONTH.
lastOfNow = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
effective = min(anniDay, lastOfNow)
if (now.getDate() < effective) months--

idx   = floor(months / span) * span
start = clampDay(a.getFullYear(), a.getMonth() + idx,        anniDay)
end   = clampDay(a.getFullYear(), a.getMonth() + idx + span, anniDay)
key   = "A" + isoDate(start)
```

Note that `clampDay` is always given the **original** `anniDay`, never a previously clamped
one — otherwise a Jan-31 anniversary would degrade to the 28th permanently after passing
through February.

**Calendar anchor** — buckets align to Jan 1:

```
span   = MONTHS[benefit.cadence]
bucket = floor(now.getMonth() / span) * span
start  = new Date(now.getFullYear(), bucket,        1)
end    = new Date(now.getFullYear(), bucket + span, 1)
key    = `${now.getFullYear()}-${pad2(bucket + 1)}`
```

`annual` gives `span = 12`, `bucket = 0`, so the key is `"YYYY-01"` — consistent with the
other cadences rather than a bare year, which keeps the parser uniform.

### `resolveBenefitValue(benefit, period)`

The effective dollar value of a benefit for a given window:

1. If `benefit.valueOverrides` has an entry for the window's **period suffix**, use it.
2. Otherwise use `benefit.value`.
3. `null` propagates — the benefit is displayed but excluded from all dollar math.

The period suffix is derived from the window start: `M1`–`M12` for monthly, `Q1`–`Q4` for
quarterly, `H1`–`H2` for semiannual, and unused for annual. This is the one place the old
`M1`/`Q1`/`H1` vocabulary survives, because it is what the extracted overrides are keyed by.

### `msr.ts`

```ts
remaining      = max(0, requirement - spent)
daysToDeadline = daysLeft(now, parse(deadline))
perWeek        = daysToDeadline > 0 ? remaining / (daysToDeadline / 7) : remaining
```

`atRisk` is true when:

- spend data exists (at least one month in `state.spend`): `perWeek` exceeds the trailing
  three-month weekly run rate — `sum(last 3 months of all-category spend) / 13`; **or**
- no spend data exists: the fallback `daysToDeadline < 14 && remaining > 0`.

An MSR with `remaining === 0` is never at risk. An MSR past its deadline with
`remaining > 0` sorts first and is rendered as missed.

Sort order for the Today strip is by **risk**, not by date: at-risk descending by
`perWeek`, then not-at-risk ascending by `daysToDeadline`.

### `breakeven.ts`

Ported from `index.html:1112-1145`, now over resolved period values rather than raw rows:

```
cardRecovered = sum of redemption amounts for the card's benefits, current year
cardPotential = sum over benefits of (resolved value × periods per year)
recoveryPct   = fee > 0 ? min(100, cardRecovered / fee * 100) : 0
netCost       = max(0, fee - cardRecovered)
```

Portfolio totals aggregate the same way across cards in the active profile. Benefits with a
`null` value contribute to neither numerator nor denominator.

### `optimizer.ts`

Ported from `index.html:1147-1180`, with the fuzzy string matching **removed** — earn rates
now carry a category slug, so `getBestCardForCategory` is an exact lookup.

- `bestCardFor(slug)` → the owned card with the highest `rate` for that slug, falling back
  to its `everything-else` rate, then to 1.
- `optimalWallet(size)` → when spend data exists, score each card as
  `Σ over categories (annual spend in category × that card's best rate for it)`; with no
  spend data, fall back to the sum of the card's rates. Return the top `size`.

---

## 5. Extraction transformations

`tools/extract_catalog.mjs` — Node, no dependencies. It parses the JSON blob at
`index.html:749` **before that file is replaced**, and is run exactly once. Every
transformation below is mechanical. Nothing is invented.

### 5.1 Collapse the exploded periods

The source explodes recurring benefits into one row per period: 216 monthly rows are
really 18 recurring benefits, 32 quarterly rows are 8, and 18 semiannual rows are 9.

1. **Group** by `(cardName, baseName, frequency)` where `baseName` is the benefit name with
   a trailing period suffix stripped — ` Jan`…` Dec`, ` Q1`…` Q4`, ` H1`…` H2`.
2. **Full-span group** (12 monthly / 4 quarterly / 2 semiannual members):
   - All values equal → emit **one** recurring benefit with that value and no
     `valueOverrides`.
   - Values differ → emit one benefit whose `value` is the **modal** value, plus
     `valueOverrides` mapping each deviating member's period key to its own value. The
     single real case is `Amex Platinum / Uber Cash`: modal `15`, overrides `{"M12": 20}`.
3. **Ill-formed group** — any group that is neither a singleton nor a complete span (a
   missing month, a duplicate month, an unparseable suffix): emit its members
   **un-collapsed**, one benefit per row, and write a line to stderr naming the card, the
   base name, and the members found. The measured input has **zero** such groups; the
   branch exists so that a future re-run degrades loudly instead of silently.
4. **Singleton** (the 17 annual rows): emit as-is.

### 5.2 Normalise polymorphic values

| Input | Output |
|---|---|
| `value` is a number | `value: <number>, displayValue: null` |
| `value` is a string, `monetaryValue` present | `value: <monetaryValue>, displayValue: <string>` |
| `value` is a string, `monetaryValue` absent | `value: null, displayValue: <string>` |

All five string-valued rows in the source fall into the last case. **A null value is
legal**: the benefit is shown in the UI and excluded from every dollar calculation. A wrong
number is worse than an absent one.

### 5.3 Multipliers → earn rates

The source has 47 distinct free-text multiplier keys, which the old app matched against 13
spending categories with substring heuristics (`index.html:1153-1157`). Those heuristics
are deleted. Mapping is an **explicit hardcoded table**; no fuzzy matching survives.

Unmapped keys map to `other` with the original text preserved in `notes`. Any key whose
mapping is lossy — a geographic or spend-band qualifier the slug cannot express — also
carries its original text in `notes`.

| Source key | Slug | Notes carried |
|---|---|---|
| `AA Purchases` | `flights` | American Airlines purchases |
| `Advertising` | `other` | Advertising |
| `Airline/Car Rental/Cruise` | `travel` | Airline / car rental / cruise |
| `AmexTravel` | `travel` | Booked via Amex Travel |
| `AmexTravel Flights` | `flights` | Booked via Amex Travel |
| `AmexTravel Hotels` | `hotels` | Booked via Amex Travel |
| `Capital One Travel Hotels/Rental Cars` | `hotels` | Booked via Capital One Travel; incl. rental cars |
| `Car Rentals` | `travel` | Car rentals |
| `Chase Travel` | `travel` | Booked via Chase Travel |
| `Construction/Hardware` | `other` | Construction / hardware |
| `Delta Purchases` | `flights` | Delta purchases |
| `Dining` | `dining` | — |
| `Dining (US Restaurants)` | `dining` | US restaurants only |
| `Dining (US Takeout/Delivery)` | `dining` | US takeout / delivery only |
| `Dining (US)` | `dining` | US only |
| `Drugstores` | `drugstores` | — |
| `Electronics` | `other` | Electronics |
| `Everything` | `everything-else` | — |
| `Everything (up to $50k)` | `everything-else` | Up to $50k/yr |
| `Everything Else` | `everything-else` | — |
| `Fitness/Gym` | `other` | Fitness / gym |
| `Flights` | `flights` | — |
| `Flights (Direct)` | `flights` | Booked direct with the airline |
| `Food Delivery` | `dining` | Food delivery |
| `Gas Stations` | `gas` | — |
| `Gas Stations (US)` | `gas` | US only |
| `Grocery` | `supermarkets` | — |
| `Hilton` | `hotels` | Hilton properties |
| `Hotels (Direct)` | `hotels` | Booked direct with the hotel |
| `Hyatt Purchases` | `hotels` | Hyatt properties |
| `Internet/Cable/Phone` | `telecom` | — |
| `JetBlue Purchases` | `flights` | JetBlue purchases |
| `Lyft` | `rideshare` | Lyft only |
| `Marriott` | `hotels` | Marriott properties |
| `Office Supply` | `office-supply` | — |
| `Over $50k` | `everything-else` | Spend above $50k/yr |
| `Purchases $5k+` | `everything-else` | Single purchases $5k+ |
| `Quarterly 5% Categories` | `other` | Rotating quarterly 5% categories |
| `Rideshare` | `rideshare` | — |
| `Shipping` | `shipping` | — |
| `Software/Cloud` | `other` | Software / cloud |
| `Streaming` | `streaming` | — |
| `Supermarkets` | `supermarkets` | — |
| `Supermarkets (US)` | `supermarkets` | US only |
| `Telcom/Cable/Satellite` | `telecom` | — |
| `Top 2 Categories Auto` | `other` | Top 2 spend categories, automatic |
| `Travel` | `travel` | — |

47 rows. Where two source keys collapse onto the same slug for one card, the higher rate
wins and both original texts are joined into `notes`.

### 5.4 `spendBenefits` → `spendThresholds`

`spendBenefits` is dead code in the current app — 9 cards carry 11 entries that nothing
reads. They become MSR **seed suggestions**, offered pre-filled when adding an MSR in the
card detail sheet. They do **not** auto-create MSRs.

```
{ name, spendRequired, yearType }  ->  { label: name, requirement: spendRequired, anchor }
```

`yearType` maps: `"Membership Year" → "anniversary"` (given by the master plan), and by
symmetry `"Calendar Year" → "calendar"`. Those are the only two values present.

The 11 thresholds: Hilton Aspire ×2, Hilton Surpass ×2, Marriott Brilliant, Marriott Bold,
World of Hyatt, JetBlue Plus, Atmos Rewards Summit, Citi AAdvantage Business, AAdvantage
Aviator Red.

### 5.5 Defaults

- Any field absent from the source → `null`.
- `caps: []` for every card. **No cap data exists in the source; do not invent it.** Caps
  are user-entered in the card detail sheet.
- `anchor: "calendar"` on every benefit and on calendar-year spend thresholds. No
  anniversary data exists in the source; anniversaries are user-entered per card.
- `slug` derived from `name`: lowercase, non-alphanumerics → `-`, collapse runs, trim.

### 5.6 Extraction gate

The tool refuses to write `data/cards.json` unless all of these hold, and prints each
check:

1. Exactly **24** cards.
2. All **283** input rows accounted for — every row is either collapsed into a group or
   emitted individually, with no row consumed twice and none dropped.
3. **Per-card annual value sums match exactly** pre- and post-collapse, where the
   post-collapse sum expands each recurring benefit back across its periods, applying
   `valueOverrides`. Rows with a null value are excluded from both sides identically.
4. Every emitted `category` is one of the 14 slugs.
5. Every emitted `cadence` and `anchor` is in its enum.
6. Zero un-collapsible groups, or a stderr report naming each one.

Then a **human reads the diff** before the file is committed.

---

## 6. Storage shim

`src/storage/api.ts`. It preserves the `load()` / `save()` interface from the previous
app's shim — that seam is why nothing above it needs to know where state lives.

```ts
load():  Promise<{ updatedAt: string | null; state: State | null }>
save(state: State): void        // debounced, fire-and-forget
flush(): void                   // synchronous best-effort, for teardown
```

### Behaviour

| Concern | Rule |
|---|---|
| Debounce | 750 ms. Every keystroke in the spend tab must not be a PUT. |
| Flush | On `visibilitychange` → `hidden` and on `pagehide`, issue the pending PUT immediately via `fetch(url, { keepalive: true, ... })`. iOS freezes pending timers when Safari backgrounds; this is the single most likely source of "it didn't save". |
| Foreground | On `visibilitychange` → `visible`, re-`GET /api/state`. If the returned `updatedAt` differs from the one held locally and there is no pending local write, replace local state. |
| 409 | Replace local state with the server state from the response body, adopt its `updatedAt`, and show a toast: **"Refreshed — your view was out of date"**. Do not retry the write; the user's change is gone by design, and silently re-applying it over fresher data is the clobber this guard exists to prevent. |
| Unreachable | A persistent banner, **mutations blocked at the reducer boundary**, and exponential backoff (1s, 2s, 4s, 8s, capped at 30s) plus a manual **Retry** button. Recovery clears the banner and unblocks. |
| Fallback | **No localStorage data fallback, ever.** Accepting writes into a local bucket while the server is down recreates exactly the divergence this design exists to prevent. `localStorage` holds view preferences only. |

Blocking at the reducer boundary — rather than by disabling every button — means one guard
covers every mutation path including keyboard entry and any future action, and it cannot be
bypassed by a component that forgot to check.

### Store

React context + `useReducer` over a pure reducer. The reducer is a total function of
`(State, Action) -> State` with no I/O. A `useEffect` subscribes to state changes and calls
`save()`. Selectors and the engine sit below React and are unit-testable without a
renderer; the shim above knows nothing about React.

---

## 7. Design tokens

`src/ui/tokens.css`.

### Palette

```css
:root {
  /* ground */
  --bg-0:  #0b1220;                        /* deeper night than the current app */
  --bg-1:  #0f1729;
  --glass-1: rgba(255,255,255,.05);        /* list surfaces */
  --glass-2: rgba(255,255,255,.09);        /* raised: sheets, MSR cards */
  --border:  rgba(255,255,255,.10);        /* 1px translucent */

  /* text */
  --text-0: #f2f5fa;
  --text-1: rgba(242,245,250,.72);
  --text-2: rgba(242,245,250,.45);

  /* semantic accents */
  --mint:   #4ade9b;   /* done / redeemed */
  --amber:  #f5b544;   /* expiring soon */
  --red:    #f4635b;   /* at risk / missed */
  --sky:    #56b6f0;   /* informational */
  --violet: #9d7cf5;   /* optimizer */
}
```

Each accent has exactly one meaning and is not reused decoratively. Issuer accent colours
carry over unchanged from the current `.issuer-*` classes.

### Type scale

`28 / 22 / 17 / 15 / 13` px, with a **17px body floor** — nothing readable is smaller than
17px except metadata at 13px. Money uses `font-variant-numeric: tabular-nums` everywhere so
columns of figures align and a changing value does not reflow.

### Space and targets

- 44px minimum touch target, **56px for the redemption toggle**
- Everything actionable lives in the bottom two-thirds of the viewport
- `padding-bottom: env(safe-area-inset-bottom)` on the tab bar and every sheet

### Surfaces

**Blur only on chrome** — bottom sheets, the tab bar, and MSR cards. List rows are flat
surfaces. A scrolling list of blurred elements destroys iOS scroll performance, and the
runway list is the most-scrolled surface in the app.

### Motion

150–200 ms `ease-out` for sheet entry, toggle state, and toast. Everything is wrapped in:

```css
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
```

---

## 8. Deploy

Follow the Mac Studio conventions exactly.

1. **Prepare.** Create `server/.venv`, install `server/requirements.txt`. Apply the SQL
   migration by hand:
   `docker exec -i <pg-container> psql -U <user> -d sovereign_ai < llm-infrastructure/scripts/pg_migrate_20260824_card_tracker.sql`
2. **Start script** — `llm-infrastructure/scripts/start_card_tracker.sh`: sources
   `llm-infrastructure/.env`, builds `DATABASE_URL` from its parts, then
   `exec .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8101`.
   Loopback only — `tailscale serve` fronts it.
3. **launchd** — `~/Library/LaunchAgents/com.llm.card-tracker.plist`, copying the shape of
   `com.llm.house-api.plist`: `RunAtLoad`, `KeepAlive` for restart-on-failure, stdout and
   stderr to `llm-infrastructure/logs/card-tracker.log`. Load with
   `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.llm.card-tracker.plist`.
4. **Expose** — `tailscale serve --bg --https=8443 http://127.0.0.1:8101`.
   A **second HTTPS port, not a sub-path**: port 443 is already taken by the OpenRouter
   dashboard, and root-path serving means zero base-href, scope, or manifest-start-URL
   configuration. The `:8443` disappears behind the home-screen icon.
   App URL: **`https://andrews-mac-studio-1.tail3683aa.ts.net:8443/`**
5. **Monitor** — add an entry to `llm-infrastructure/scripts/health_check.sh` probing
   `http://127.0.0.1:8101/api/health`. Then **verify** `pmset -g` reports the machine will
   not sleep. Check it; do not assume it. A sleeping Mac Studio means the app is dead from
   the phone with no useful error.
6. **Ship the client** — `npm run deploy` = `npm run build` then copy `dist/*` into
   `server/static/`. Deployment of the client is a file copy; no restart is needed.

---

## 9. Import schema documentation

`docs/card-schema.md` is the single source of truth for the import format. It contains:

1. An **annotated example** of a full catalog card with every field commented.
2. A **field reference table** — type, required/optional, enum values, and what `null`
   means for each.
3. A **copy-paste LLM prompt block** so a new card can be added by pasting a benefits page
   into any chat window:

   > Format the credit-card benefits below as JSON matching this exact schema. Use `null`
   > for any value you are not certain of — do not guess amounts. `cadence` must be one of
   > `monthly`, `quarterly`, `semiannual`, `annual`. `anchor` must be `calendar` or
   > `anniversary`. `category` must be one of: dining, supermarkets, gas, travel, hotels,
   > flights, office-supply, telecom, shipping, drugstores, rideshare, streaming,
   > everything-else, other. Output only the JSON. \[schema + example follow]

The importer's validation messages and this document must agree; a drift between them is a
bug in the importer.
