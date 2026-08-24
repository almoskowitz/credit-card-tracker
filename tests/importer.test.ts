import { describe, it, expect } from 'vitest';
import { validateCatalogCard, validateBenefit, validatePaste } from '../src/catalog/importer';

const VALID_CARD = {
  slug: 'amex-platinum',
  name: 'Amex Platinum',
  issuer: 'American Express',
  annualFee: 695,
  benefits: [
    {
      name: 'Uber Cash',
      value: 15,
      displayValue: null,
      cadence: 'monthly',
      anchor: 'calendar',
      category: 'rideshare',
      valueOverrides: { M12: 20 },
    },
    {
      name: 'Free Night Award',
      value: null,
      displayValue: 'Up to 85k pts',
      cadence: 'annual',
      anchor: 'calendar',
      category: 'hotels',
    },
  ],
  earnRates: [{ category: 'flights', rate: 5, notes: null }],
  caps: [],
  spendThresholds: [{ label: 'Second Free Night', requirement: 30000, anchor: 'calendar' }],
};

const VALID_BENEFIT = {
  name: 'Dining Credit',
  value: 10,
  displayValue: null,
  cadence: 'monthly',
  anchor: 'calendar',
  category: 'dining',
};

describe('validateCatalogCard', () => {
  it('accepts a valid card', () => {
    const result = validateCatalogCard(VALID_CARD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe('amex-platinum');
      expect(result.value.benefits).toHaveLength(2);
      expect(result.value.benefits[0].valueOverrides).toEqual({ M12: 20 });
    }
  });

  it('reports a bad cadence with its path and the accepted values', () => {
    const bad = {
      ...VALID_CARD,
      benefits: [
        VALID_CARD.benefits[0],
        VALID_CARD.benefits[1],
        { ...VALID_CARD.benefits[0], cadence: 'biannual' },
      ],
    };
    const result = validateCatalogCard(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('benefits[2].cadence must be monthly|quarterly|semiannual|annual');
    }
  });

  it('rejects an unknown field rather than dropping it', () => {
    const bad = { ...VALID_CARD, notARealField: true };
    const result = validateCatalogCard(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('notARealField is not a recognized field');
    }
  });

  it('reports multiple simultaneous errors', () => {
    const bad = {
      ...VALID_CARD,
      benefits: [{ ...VALID_CARD.benefits[0], cadence: 'biannual', category: 'not-a-real-category' }],
    };
    delete (bad as Record<string, unknown>).issuer;
    const result = validateCatalogCard(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors.some((e) => e.includes('issuer'))).toBe(true);
      expect(result.errors.some((e) => e.includes('benefits[0].cadence'))).toBe(true);
      expect(result.errors.some((e) => e.includes('benefits[0].category'))).toBe(true);
    }
  });
});

describe('validateBenefit', () => {
  it('accepts a valid bare benefit', () => {
    const result = validateBenefit(VALID_BENEFIT);
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = validateBenefit({ ...VALID_BENEFIT, category: 'not-a-category' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.startsWith('category must be one of:'))).toBe(true);
    }
  });

  it('requires a name', () => {
    const { name: _name, ...rest } = VALID_BENEFIT;
    const result = validateBenefit(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('name is required');
    }
  });
});

describe('validatePaste', () => {
  it('distinguishes malformed JSON from a schema violation', () => {
    const result = validatePaste('{ "slug": "x", }'); // trailing comma
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('parse');
  });

  it('previews a valid pasted card', () => {
    const result = validatePaste(JSON.stringify(VALID_CARD));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('card');
  });

  it('previews a valid pasted bare benefit', () => {
    const result = validatePaste(JSON.stringify(VALID_BENEFIT));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('benefit');
  });

  it('reports a schema violation distinctly from a parse failure', () => {
    const result = validatePaste(JSON.stringify({ ...VALID_CARD, annualFee: 'a lot' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('schema');
  });
});
