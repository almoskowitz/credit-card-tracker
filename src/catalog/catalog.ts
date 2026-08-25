import type { Anchor, Benefit, Card, EarnRate } from '../state/schema';
import type { Cadence } from '../engine/period';

export interface CatalogBenefit {
  name: string;
  value: number | null;
  displayValue: string | null;
  cadence: Cadence;
  anchor: Anchor;
  category: string;
  valueOverrides?: Record<string, number>;
  /** Annual spend that earns this benefit; present only on spend-gated certificates. */
  unlockSpend?: number | null;
}

export interface CatalogEarnRate {
  category: string;
  rate: number;
  notes?: string | null;
}

export interface CatalogSpendThreshold {
  label: string;
  requirement: number;
  anchor: Anchor;
}

export interface CatalogCard {
  slug: string;
  name: string;
  issuer: string;
  annualFee: number | null;
  rewardCurrency?: string | null;
  benefits: CatalogBenefit[];
  earnRates: CatalogEarnRate[];
  caps: never[];
  spendThresholds: CatalogSpendThreshold[];
}

export interface Catalog {
  schemaVersion: 1;
  updated: string;
  categories: { slug: string; name: string }[];
  cards: CatalogCard[];
}

export interface CopiedCard {
  card: Card;
  benefits: Benefit[];
  earnRates: EarnRate[];
}

/**
 * One catalog benefit as a user-state benefit with a fresh UUID. A spend-gated certificate
 * arrives switched off — it isn't earned until the spend happens, and the user flips it on.
 */
export function benefitFromCatalog(b: CatalogBenefit, cardId: string): Benefit {
  const unlockSpend = b.unlockSpend ?? null;
  return {
    id: crypto.randomUUID(),
    cardId,
    name: b.name,
    value: b.value,
    displayValue: b.displayValue,
    valueOverrides: b.valueOverrides ?? null,
    cadence: b.cadence,
    anchor: b.anchor,
    category: b.category,
    notes: null,
    unlockSpend,
    enabled: unlockSpend === null,
  };
}

/**
 * Deep-copies a catalog card into user state with fresh UUIDs on every entity. The catalog
 * is never read live for an owned card again after this — `slug` on the resulting Card is
 * provenance only, not a lookup key. See design.md §1 "Copy-on-add".
 */
export function copyCardFromCatalog(catalogCard: CatalogCard, profileId: string): CopiedCard {
  const cardId = crypto.randomUUID();

  const card: Card = {
    id: cardId,
    profileId,
    slug: catalogCard.slug,
    name: catalogCard.name,
    issuer: catalogCard.issuer,
    fee: catalogCard.annualFee,
    anniversary: null,
    opened: null,
    closed: null,
    rewardCurrency: catalogCard.rewardCurrency ?? null,
  };

  const benefits: Benefit[] = catalogCard.benefits.map((b) => benefitFromCatalog(b, cardId));

  const earnRates: EarnRate[] = catalogCard.earnRates.map((e) => ({
    id: crypto.randomUUID(),
    cardId,
    category: e.category,
    rate: e.rate,
    notes: e.notes ?? null,
  }));

  return { card, benefits, earnRates };
}
