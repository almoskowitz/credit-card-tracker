import { describe, it, expect } from 'vitest';
import { cardBreakeven, portfolioBreakeven, potentialAnnualValue, type BreakevenBenefit, type BreakevenCard } from '../src/engine/breakeven';

const now = new Date(2026, 7, 15);

describe('cardBreakeven', () => {
  it('per-card recovery', () => {
    const card: BreakevenCard = { id: 'c1', fee: 695 };
    const redemptions = { 'b1|2026-01': 400 };
    const benefits: BreakevenBenefit[] = [{ id: 'b1', cardId: 'c1', value: 400, cadence: 'annual' }];
    const cb = cardBreakeven(card, benefits, redemptions, now);
    expect(Math.round(cb.recoveryPct * 10) / 10).toBe(57.6);
    expect(cb.netCost).toBe(295);
  });

  it('recovery is capped and net cost floored', () => {
    const card: BreakevenCard = { id: 'c1', fee: 95 };
    const redemptions = { 'b1|2026-01': 300 };
    const benefits: BreakevenBenefit[] = [{ id: 'b1', cardId: 'c1', value: 300, cadence: 'annual' }];
    const cb = cardBreakeven(card, benefits, redemptions, now);
    expect(cb.recoveryPct).toBe(100);
    expect(cb.netCost).toBe(0);
  });

  it('a no-fee card does not divide by zero', () => {
    const card: BreakevenCard = { id: 'c1', fee: 0 };
    const redemptions = { 'b1|2026-01': 50 };
    const benefits: BreakevenBenefit[] = [{ id: 'b1', cardId: 'c1', value: 50, cadence: 'annual' }];
    const cb = cardBreakeven(card, benefits, redemptions, now);
    expect(cb.recoveryPct).toBe(0);
    expect(cb.netCost).toBe(0);
    expect(Number.isFinite(cb.recoveryPct)).toBe(true);
    expect(Number.isFinite(cb.netCost)).toBe(true);
  });

  it('a null-valued benefit contributes to neither recovered nor potential', () => {
    const card: BreakevenCard = { id: 'c1', fee: 200 };
    const benefits: BreakevenBenefit[] = [
      { id: 'b1', cardId: 'c1', value: 100, cadence: 'annual' },
      { id: 'b2', cardId: 'c1', value: null, cadence: 'annual' },
    ];
    const cb = cardBreakeven(card, benefits, {}, now);
    expect(cb.potential).toBe(100);
  });

  it('ignores redemptions outside the current year', () => {
    const card: BreakevenCard = { id: 'c1', fee: 100 };
    const benefits: BreakevenBenefit[] = [{ id: 'b1', cardId: 'c1', value: 50, cadence: 'annual' }];
    const redemptions = { 'b1|2025-01': 50, 'b1|2026-01': 30 };
    const cb = cardBreakeven(card, benefits, redemptions, now);
    expect(cb.recovered).toBe(30);
  });
});

describe('potentialAnnualValue', () => {
  it('expands recurring benefits across the year', () => {
    const benefit: BreakevenBenefit = {
      id: 'b1',
      cardId: 'c1',
      value: 15,
      cadence: 'monthly',
      valueOverrides: { M12: 20 },
    };
    expect(potentialAnnualValue(benefit)).toBe(185);
  });

  it('annual benefits ignore valueOverrides entirely', () => {
    const benefit: BreakevenBenefit = {
      id: 'b1',
      cardId: 'c1',
      value: 100,
      cadence: 'annual',
      valueOverrides: { M1: 999 },
    };
    expect(potentialAnnualValue(benefit)).toBe(100);
  });
});

describe('portfolioBreakeven', () => {
  it('aggregates only the cards it is given (active profile filtering is a caller concern)', () => {
    const profileACards: BreakevenCard[] = [{ id: 'a1', fee: 100 }, { id: 'a2', fee: 200 }];
    const profileBCards: BreakevenCard[] = [{ id: 'b1', fee: 500 }];
    const benefits: BreakevenBenefit[] = [
      { id: 'ba1', cardId: 'a1', value: 50, cadence: 'annual' },
      { id: 'ba2', cardId: 'a2', value: 100, cadence: 'annual' },
      { id: 'bb1', cardId: 'b1', value: 500, cadence: 'annual' },
    ];
    const redemptions = { 'ba1|2026-01': 50, 'ba2|2026-01': 100, 'bb1|2026-01': 500 };

    const totals = portfolioBreakeven(profileACards, benefits, redemptions, now);
    expect(totals.totalFees).toBe(300);
    expect(totals.recovered).toBe(150);

    const otherTotals = portfolioBreakeven(profileBCards, benefits, redemptions, now);
    expect(otherTotals.totalFees).toBe(500);
    expect(otherTotals.recovered).toBe(500);
  });
});
