# Contributing

This is a single-user personal project (see `openspec/project.md`), not one that takes
outside pull requests. This file documents the one thing worth writing down for a future
contributor (including future-you): how to add a card.

## Adding a card

Prefer the in-app flow — Settings → Add Card → paste a JSON object matching the catalog
schema, validated on the way in by `src/catalog/importer.ts`. See
[`docs/card-schema.md`](docs/card-schema.md) for the field reference, an annotated
example, and a copy-paste prompt for turning a benefits page into that JSON with an LLM.

To add a card to the seed catalog itself (`data/cards.json`, read only when adding a card
to a wallet — see `README.md`), append an entry matching the same schema and run
`npm run validate:catalog` to confirm it passes.

## Code changes

1. `npm install`
2. Make the change, respecting the layering rule in `CLAUDE.md`: the engine and
   selectors are React-free, the store is HTTP-free, only `src/storage/api.ts` calls
   `fetch`.
3. `npm test` — all vitest suites must stay green.
4. `npm run build` — must succeed.

See `README.md` for the full dev workflow, server setup, and deploy steps.
