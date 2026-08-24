import type { Benefit, Card, Msr, State } from './schema';
import { daysLeft, ledgerKey, parseLocalDate, periodFor, resolveBenefitValue, type Period } from '../engine/period';
import { evaluateMsr, sortMsrs, type MsrStatus } from '../engine/msr';
import { cardBreakeven, portfolioBreakeven, type Breakeven, type PortfolioBreakeven } from '../engine/breakeven';

function isClosedAsOf(closed: string | null, now: Date): boolean {
  const d = parseLocalDate(closed);
  return d !== null && d <= now;
}

/** Excludes cards closed on or before `now` — a closed card leaves every active view, though its historical redemptions stay in state (see `cardBreakevenFor`, which looks a card up directly and is unaffected). */
export function cardsForProfile(state: State, profileId: string, now: Date = new Date()): Card[] {
  return state.cards.filter((c) => c.profileId === profileId && !isClosedAsOf(c.closed, now));
}

export interface RunwayItem {
  benefit: Benefit;
  card: Card;
  period: Period;
  value: number | null;
  daysLeft: number;
  redeemed: boolean;
  redeemedAmount: number | null;
}

/** All benefits belonging to the active profile's cards, resolved for the current period. */
export function runwayItems(state: State, profileId: string, now: Date = new Date()): RunwayItem[] {
  const cardsById = new Map(cardsForProfile(state, profileId, now).map((c) => [c.id, c]));
  const items: RunwayItem[] = [];
  for (const benefit of state.benefits) {
    const card = cardsById.get(benefit.cardId);
    if (!card) continue;
    const period = periodFor(benefit, card, now);
    const value = resolveBenefitValue(benefit, period);
    const key = ledgerKey(benefit.id, period.key);
    const redeemedAmount = Object.prototype.hasOwnProperty.call(state.redemptions, key) ? state.redemptions[key] : null;
    items.push({
      benefit,
      card,
      period,
      value,
      daysLeft: daysLeft(now, period.end),
      redeemed: redeemedAmount !== null,
      redeemedAmount,
    });
  }
  return items;
}

export interface RunwayGroups {
  endingThisWeek: RunwayItem[];
  endingThisMonth: RunwayItem[];
  laterThisPeriod: RunwayItem[];
  done: RunwayItem[];
}

/** Redeemed items land in `done`; everything else buckets by days left, each sorted soonest-first. */
export function groupRunway(items: RunwayItem[]): RunwayGroups {
  const groups: RunwayGroups = { endingThisWeek: [], endingThisMonth: [], laterThisPeriod: [], done: [] };
  for (const item of items) {
    if (item.redeemed) {
      groups.done.push(item);
      continue;
    }
    if (item.daysLeft <= 7) groups.endingThisWeek.push(item);
    else if (item.daysLeft <= 31) groups.endingThisMonth.push(item);
    else groups.laterThisPeriod.push(item);
  }
  const byDaysLeft = (a: RunwayItem, b: RunwayItem) => a.daysLeft - b.daysLeft;
  groups.endingThisWeek.sort(byDaysLeft);
  groups.endingThisMonth.sort(byDaysLeft);
  groups.laterThisPeriod.sort(byDaysLeft);
  return groups;
}

export interface MsrWithStatus extends Msr, MsrStatus {}

/** MSRs for the active profile's cards, risk-sorted per engine/msr.ts. */
export function msrsForProfile(state: State, profileId: string, now: Date = new Date()): MsrWithStatus[] {
  const cardIds = new Set(cardsForProfile(state, profileId, now).map((c) => c.id));
  const relevant = state.msrs.filter((m) => cardIds.has(m.cardId));
  return sortMsrs(relevant.map((m) => evaluateMsr(m, state.spend, now)));
}

export function cardBreakevenFor(state: State, cardId: string, now: Date = new Date()): Breakeven {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return cardBreakeven(card, state.benefits, state.redemptions, now);
}

export function portfolioBreakevenForProfile(state: State, profileId: string, now: Date = new Date()): PortfolioBreakeven {
  return portfolioBreakeven(cardsForProfile(state, profileId, now), state.benefits, state.redemptions, now);
}
