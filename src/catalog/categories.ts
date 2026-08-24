/**
 * The closed 14-slug category taxonomy — identical to `data/cards.json`'s `categories[]`
 * and the field reference in `docs/card-schema.md`. Kept as its own tiny module so any
 * picker (earn rates, benefit category, blank-form) can import it without pulling in the
 * full 24-card catalog payload.
 */
export interface CategoryDef {
  slug: string;
  name: string;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'dining', name: 'Dining' },
  { slug: 'supermarkets', name: 'Supermarkets' },
  { slug: 'gas', name: 'Gas Stations' },
  { slug: 'travel', name: 'Travel' },
  { slug: 'hotels', name: 'Hotels' },
  { slug: 'flights', name: 'Flights' },
  { slug: 'office-supply', name: 'Office Supply' },
  { slug: 'telecom', name: 'Internet / Cable / Phone' },
  { slug: 'shipping', name: 'Shipping' },
  { slug: 'drugstores', name: 'Drugstores' },
  { slug: 'rideshare', name: 'Rideshare' },
  { slug: 'streaming', name: 'Streaming' },
  { slug: 'everything-else', name: 'Everything Else' },
  { slug: 'other', name: 'Other' },
];

export const CATEGORY_SLUGS: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.slug));

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
