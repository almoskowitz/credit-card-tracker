import { describe, it, expect } from 'vitest';
import { defaultState } from '../src/state/schema';
import type { Benefit, Card, Msr, State } from '../src/state/schema';
import {
  cardsForProfile,
  cardBreakevenFor,
  groupRunway,
  msrsForProfile,
  portfolioBreakevenForProfile,
  runwayItems,
  type RunwayItem,
} from '../src/state/selectors';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    profileId: 'profile-1',
    slug: null,
    name: 'Test Card',
    issuer: 'Test Bank',
    fee: 100,
    anniversary: null,
    opened: null,
    closed: null,
    ...overrides,
  };
}

function makeBenefit(overrides: Partial<Benefit> = {}): Benefit {
  return {
    id: 'benefit-1',
    cardId: 'card-1',
    name: 'Test Benefit',
    value: 10,
    displayValue: null,
    valueOverrides: null,
    cadence: 'annual',
    anchor: 'calendar',
    category: 'other',
    notes: null,
    ...overrides,
  };
}

function baseState(overrides: Partial<State> = {}): State {
  return { ...defaultState(), profiles: [{ id: 'profile-1', name: 'Personal' }], ...overrides };
}

describe('cardsForProfile', () => {
  it('shows only the active profile cards', () => {
    const state = baseState({
      cards: [makeCard({ id: 'a', profileId: 'profile-1' }), makeCard({ id: 'b', profileId: 'profile-2' })],
    });
    expect(cardsForProfile(state, 'profile-1').map((c) => c.id)).toEqual(['a']);
  });
});

describe('runwayItems', () => {
  it('excludes benefits belonging to other profiles', () => {
    const state = baseState({
      cards: [makeCard({ id: 'a', profileId: 'profile-1' }), makeCard({ id: 'b', profileId: 'profile-2' })],
      benefits: [makeBenefit({ id: 'ba', cardId: 'a' }), makeBenefit({ id: 'bb', cardId: 'b' })],
    });
    const items = runwayItems(state, 'profile-1');
    expect(items.map((i) => i.benefit.id)).toEqual(['ba']);
  });

  it('carries a null-valued benefit through with its display text', () => {
    const state = baseState({
      cards: [makeCard()],
      benefits: [makeBenefit({ value: null, displayValue: 'Up to 85k pts' })],
    });
    const [item] = runwayItems(state, 'profile-1');
    expect(item.value).toBeNull();
    expect(item.benefit.displayValue).toBe('Up to 85k pts');
  });

  it('marks a benefit redeemed when its ledger key is present', () => {
    const now = new Date(2026, 5, 15);
    const state = baseState({
      cards: [makeCard()],
      benefits: [makeBenefit({ id: 'benefit-1', cadence: 'annual' })],
    });
    const [{ period }] = runwayItems(state, 'profile-1', now);
    const redeemedState = { ...state, redemptions: { [`benefit-1|${period.key}`]: 10 } };
    const [item] = runwayItems(redeemedState, 'profile-1', now);
    expect(item.redeemed).toBe(true);
    expect(item.redeemedAmount).toBe(10);
  });
});

describe('groupRunway', () => {
  function item(daysLeft: number, redeemed = false): RunwayItem {
    return {
      benefit: makeBenefit(),
      card: makeCard(),
      period: { start: new Date(), end: new Date(), key: '2026-01' },
      value: 10,
      daysLeft,
      redeemed,
      redeemedAmount: redeemed ? 10 : null,
    };
  }

  it('buckets 3/19/150 days into the three groups', () => {
    const groups = groupRunway([item(150), item(3), item(19)]);
    expect(groups.endingThisWeek.map((i) => i.daysLeft)).toEqual([3]);
    expect(groups.endingThisMonth.map((i) => i.daysLeft)).toEqual([19]);
    expect(groups.laterThisPeriod.map((i) => i.daysLeft)).toEqual([150]);
  });

  it('puts redeemed items in done regardless of days left', () => {
    const groups = groupRunway([item(2, true)]);
    expect(groups.done).toHaveLength(1);
    expect(groups.endingThisWeek).toHaveLength(0);
  });

  it('sorts each active group soonest-first', () => {
    const groups = groupRunway([item(7), item(1), item(4)]);
    expect(groups.endingThisWeek.map((i) => i.daysLeft)).toEqual([1, 4, 7]);
  });
});

describe('msrsForProfile', () => {
  function makeMsr(overrides: Partial<Msr> = {}): Msr {
    return {
      id: 'msr-1',
      cardId: 'card-1',
      label: 'Sign-up bonus',
      requirement: 4000,
      deadline: '2026-07-01',
      spent: 0,
      bonuses: [],
      notes: null,
      ...overrides,
    };
  }

  it('excludes MSRs belonging to other profiles', () => {
    const state = baseState({
      cards: [makeCard({ id: 'a', profileId: 'profile-1' }), makeCard({ id: 'b', profileId: 'profile-2' })],
      msrs: [makeMsr({ id: 'ma', cardId: 'a' }), makeMsr({ id: 'mb', cardId: 'b' })],
    });
    expect(msrsForProfile(state, 'profile-1').map((m) => m.id)).toEqual(['ma']);
  });

  it('sorts at-risk descending by pace ahead of on-track MSRs', () => {
    const now = new Date(2026, 5, 1);
    const state = baseState({
      cards: [makeCard()],
      msrs: [
        makeMsr({ id: 'safe', requirement: 100, spent: 90, deadline: '2026-12-31' }),
        makeMsr({ id: 'risky', requirement: 4000, spent: 0, deadline: '2026-06-05' }),
      ],
    });
    const ordered = msrsForProfile(state, 'profile-1', now);
    expect(ordered[0].id).toBe('risky');
    expect(ordered[0].atRisk).toBe(true);
  });
});

describe('breakeven selectors', () => {
  it('computes a single card break-even filtered from state', () => {
    const state = baseState({
      cards: [makeCard({ id: 'a', fee: 695 })],
      benefits: [makeBenefit({ id: 'b1', cardId: 'a', value: 400, cadence: 'annual' })],
      redemptions: { 'b1|2026-01': 400 },
    });
    const result = cardBreakevenFor(state, 'a', new Date(2026, 5, 1));
    expect(result.recovered).toBe(400);
    expect(result.netCost).toBe(295);
  });

  it('aggregates portfolio break-even for only the active profile', () => {
    const state = baseState({
      cards: [makeCard({ id: 'a', profileId: 'profile-1', fee: 695 }), makeCard({ id: 'b', profileId: 'profile-2', fee: 250 })],
      benefits: [
        makeBenefit({ id: 'ba', cardId: 'a', value: 400, cadence: 'annual' }),
        makeBenefit({ id: 'bb', cardId: 'b', value: 250, cadence: 'annual' }),
      ],
      redemptions: { 'ba|2026-01': 400, 'bb|2026-01': 250 },
    });
    const result = portfolioBreakevenForProfile(state, 'profile-1', new Date(2026, 5, 1));
    expect(result.totalFees).toBe(695);
    expect(result.recovered).toBe(400);
  });
});
