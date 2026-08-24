import { describe, it, expect } from 'vitest';
import { bestCardForCategory, effectiveRate, optimalWallet, type OptimizerCard, type Spend } from '../src/engine/optimizer';

describe('bestCardForCategory', () => {
  it('is an exact lookup with no substring matching', () => {
    const cards: OptimizerCard[] = [
      { id: 'c1', earnRates: [{ category: 'dining', rate: 4 }] },
      { id: 'c2', earnRates: [{ category: 'dining', rate: 3 }] },
      { id: 'c3', earnRates: [{ category: 'dining', rate: 1 }] },
      { id: 'c4', earnRates: [{ category: 'fine-dining-club', rate: 10 }] }, // must not match 'dining'
    ];
    const best = bestCardForCategory(cards, 'dining');
    expect(best?.card.id).toBe('c1');
    expect(best?.rate).toBe(4);
  });

  it('a card with no rate for a category falls back to everything-else, then to 1', () => {
    const fallbackCard: OptimizerCard = { id: 'c1', earnRates: [{ category: 'everything-else', rate: 2 }] };
    const noRateCard: OptimizerCard = { id: 'c2', earnRates: [{ category: 'gas', rate: 5 }] };
    expect(effectiveRate(fallbackCard, 'dining')).toBe(2);
    expect(effectiveRate(noRateCard, 'dining')).toBe(1);
  });
});

describe('optimalWallet', () => {
  it('scores by spending when spend data exists', () => {
    const cards: OptimizerCard[] = [
      { id: 'dining-card', earnRates: [{ category: 'dining', rate: 4 }, { category: 'gas', rate: 1 }] },
      { id: 'gas-card', earnRates: [{ category: 'dining', rate: 1 }, { category: 'gas', rate: 5 }] },
      { id: 'flat-card', earnRates: [{ category: 'everything-else', rate: 2 }] },
      { id: 'weak-card', earnRates: [{ category: 'dining', rate: 1 }, { category: 'gas', rate: 1 }] },
    ];
    const spend: Spend = { '2026-01': { dining: 12000, gas: 2000 } };
    // dining-card: 12000*4 + 2000*1 = 50000
    // gas-card:    12000*1 + 2000*5 = 22000
    // flat-card:   12000*2 + 2000*2 = 28000
    // weak-card:   12000*1 + 2000*1 = 14000
    const wallet = optimalWallet(cards, spend, 3);
    expect(wallet.map((c) => c.id)).toEqual(['dining-card', 'flat-card', 'gas-card']);
  });

  it('falls back to rate sums with no spend data', () => {
    const cards: OptimizerCard[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      earnRates: [{ category: 'dining', rate: i + 1 }],
    }));
    const wallet = optimalWallet(cards, {}, 5);
    expect(wallet).toHaveLength(5);
    expect(wallet.map((c) => c.id)).toEqual(['c4', 'c3', 'c2', 'c1', 'c0']);
  });

  it('requesting more cards than are owned returns only what exists', () => {
    const cards: OptimizerCard[] = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`,
      earnRates: [{ category: 'dining', rate: i + 1 }],
    }));
    const wallet = optimalWallet(cards, {}, 7);
    expect(wallet).toHaveLength(4);
  });
});
