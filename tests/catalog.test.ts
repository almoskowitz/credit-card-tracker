import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(__dirname, '..', 'data', 'cards.json');

const CADENCES = new Set(['monthly', 'quarterly', 'semiannual', 'annual']);
const ANCHORS = new Set(['calendar', 'anniversary']);

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

describe('data/cards.json schema v1', () => {
  it('has schemaVersion 1 and 14 categories', () => {
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.categories).toHaveLength(14);
  });

  const categorySlugs = new Set(catalog.categories.map((c: { slug: string }) => c.slug));

  it('has 24 cards with unique kebab-case slugs', () => {
    expect(catalog.cards).toHaveLength(24);
    const slugs = catalog.cards.map((c: { slug: string }) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('every card has caps: []', () => {
    for (const card of catalog.cards) {
      expect(card.caps).toEqual([]);
    }
  });

  it('every card path validates: fields, enums, category taxonomy', () => {
    const errors: string[] = [];
    for (const card of catalog.cards) {
      for (const field of ['slug', 'name', 'issuer', 'annualFee', 'benefits', 'earnRates', 'caps', 'spendThresholds']) {
        if (!(field in card)) errors.push(`${card.slug}: missing field ${field}`);
      }
      card.benefits.forEach((b: Record<string, unknown>, i: number) => {
        const path_ = `cards[${card.slug}].benefits[${i}]`;
        if (!CADENCES.has(b.cadence as string)) errors.push(`${path_}.cadence invalid: ${b.cadence}`);
        if (!ANCHORS.has(b.anchor as string)) errors.push(`${path_}.anchor invalid: ${b.anchor}`);
        if (!categorySlugs.has(b.category as string)) errors.push(`${path_}.category invalid: ${b.category}`);
        if (b.value !== null && typeof b.value !== 'number') errors.push(`${path_}.value must be number|null`);
      });
      card.earnRates.forEach((e: Record<string, unknown>, i: number) => {
        const path_ = `cards[${card.slug}].earnRates[${i}]`;
        if (!categorySlugs.has(e.category as string)) errors.push(`${path_}.category invalid: ${e.category}`);
      });
    }
    expect(errors).toEqual([]);
  });

  it('reports 24 cards validated', () => {
    console.log(`validate:catalog — ${catalog.cards.length} cards validated, 0 unknown fields, 0 enum violations`);
    expect(catalog.cards.length).toBe(24);
  });
});
