# Card schema

`data/cards.json` — the reference catalog. Seed data for adding a card to a wallet;
never read live for a card the user already owns (adding a card deep-copies it, with
fresh UUIDs, into user state — see `openspec/changes/rebuild-v3/design.md` §1).

This document is the single source of truth for the import format used by
`src/catalog/importer.ts` and the catalog paste/blank-form add tiers. If those flows and
this document disagree, that disagreement is a bug in the importer.

## Annotated example

```json
{
  "slug": "amex-platinum",              // kebab-case, unique, stable — derived from name
  "name": "Amex Platinum",
  "issuer": "American Express",
  "annualFee": 695,                     // number, or null if unknown (never 0 for "unknown")
  "rewardCurrency": "membership-rewards", // optional -- a RewardCurrency id (Settings > Point
                                         // valuations); omit or null defaults to "cash"
  "benefits": [
    {
      "name": "Uber Cash",
      "value": 15,                      // dollar value per period; null if not monetary
      "displayValue": null,             // human text when value is not a dollar amount
      "cadence": "monthly",             // monthly | quarterly | semiannual | annual
      "anchor": "calendar",             // calendar | anniversary
      "category": "rideshare",          // one of the 14 category slugs below
      "valueOverrides": { "M12": 20 }   // optional: period-suffix -> value, for periods
                                         // that differ from the base value above
    },
    {
      "name": "Free Night Award",
      "value": null,                    // null is legal: shown in the UI, excluded from
      "displayValue": "Up to 85k pts",  // all dollar math
      "cadence": "annual",
      "anchor": "calendar",
      "category": "hotels"
    },
    {
      "name": "Second Free Night Reward",
      "value": 500,
      "displayValue": "Any Hilton property",
      "cadence": "annual",
      "anchor": "calendar",
      "category": "hotels",
      "unlockSpend": 30000              // optional: annual spend that earns this benefit.
                                         // Added switched OFF — the user toggles it on once
                                         // the spend happens. Omit for always-granted perks.
    }
  ],
  "earnRates": [
    { "category": "flights", "rate": 5, "notes": "AmexTravel Flights" }
    // notes carries the original qualifier text when the mapping to a category is lossy
  ],
  "caps": [],                           // always empty in the catalog; caps are user-entered
  "spendThresholds": [
    { "label": "Second Free Night", "requirement": 30000, "anchor": "calendar" }
    // seeds for the MSR add form — does not create an MSR by itself
  ]
}
```

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | Kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), unique, stable |
| `name` | string | yes | Display name |
| `issuer` | string | yes | e.g. "American Express", "Chase" |
| `annualFee` | number \| null | yes | `null` means unknown, never `0` for "unknown" |
| `rewardCurrency` | string \| null | no | A `RewardCurrency` id (see Settings > Point valuations); omitted or `null` means "cash" |
| `benefits` | array | yes | May be empty |
| `benefits[].name` | string | yes | |
| `benefits[].value` | number \| null | yes | Dollar value per period, or `null` |
| `benefits[].displayValue` | string \| null | yes | Human text when `value` is not monetary |
| `benefits[].cadence` | enum | yes | `monthly` \| `quarterly` \| `semiannual` \| `annual` |
| `benefits[].anchor` | enum | yes | `calendar` \| `anniversary` |
| `benefits[].category` | slug | yes | One of the 14 category slugs |
| `benefits[].valueOverrides` | object | no | Keys are period suffixes (`M1`-`M12`, `Q1`-`Q4`, `H1`-`H2`); values are numbers. Omit when there are no overrides. |
| `benefits[].unlockSpend` | number | no | Annual spend that earns this benefit (a free-night certificate at $15k). Must be positive. Such a benefit is added switched off and stays out of the runway and break-even until the user toggles it on. Omit for always-granted benefits. |
| `earnRates` | array | yes | May be empty |
| `earnRates[].category` | slug | yes | One of the 14 category slugs |
| `earnRates[].rate` | number | yes | Multiplier, e.g. `4` for 4x |
| `earnRates[].notes` | string \| null | yes | Original qualifier text when the category mapping is lossy; `null` otherwise |
| `caps` | array | yes | Always `[]` in the catalog |
| `spendThresholds` | array | yes | May be empty |
| `spendThresholds[].label` | string | yes | |
| `spendThresholds[].requirement` | number | yes | Spend required, in dollars |
| `spendThresholds[].anchor` | enum | yes | `calendar` \| `anniversary` |

### Category taxonomy (closed, 14 slugs)

`dining`, `supermarkets`, `gas`, `travel`, `hotels`, `flights`, `office-supply`,
`telecom`, `shipping`, `drugstores`, `rideshare`, `streaming`, `everything-else`, `other`.

## Copy-paste LLM prompt

Paste this, followed by a benefits page for the card you want to add, into any chat
window. The output is accepted by the importer without editing.

> Format the credit-card benefits below as JSON matching this exact schema. Use `null`
> for any value you are not certain of — do not guess amounts. `cadence` must be one of
> `monthly`, `quarterly`, `semiannual`, `annual`. `anchor` must be `calendar` or
> `anniversary`. `category` must be one of: dining, supermarkets, gas, travel, hotels,
> flights, office-supply, telecom, shipping, drugstores, rideshare, streaming,
> everything-else, other. Output only the JSON.
>
> ```json
> {
>   "slug": "",
>   "name": "",
>   "issuer": "",
>   "annualFee": null,
>   "benefits": [
>     {
>       "name": "",
>       "value": null,
>       "displayValue": null,
>       "cadence": "monthly",
>       "anchor": "calendar",
>       "category": "other"
>     }
>   ],
>   "earnRates": [
>     { "category": "other", "rate": 1, "notes": null }
>   ],
>   "caps": [],
>   "spendThresholds": []
> }
> ```

A bare benefit (added directly to an owned card rather than as part of a new catalog
card) uses the same `benefits[]` object shape on its own.
