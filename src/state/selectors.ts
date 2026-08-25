import type { Benefit, Card, Msr, State } from './schema';
import { daysLeft, isScheduledPeriodKey, ledgerKey, parseLocalDate, periodFor, resolveBenefitValue, type Period } from '../engine/period';
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
  /** Fully used — the ledger amount reached the benefit's value. Only these leave the runway. */
  redeemed: boolean;
  /** Some but not all of the value used. Stays on the runway, showing what's left. */
  partial: boolean;
  redeemedAmount: number | null;
  /** Still on the runway; null for a benefit with no dollar value (a certificate). */
  remaining: number | null;
}

/**
 * How far through a benefit one period's ledger amount gets you — the single place that
 * decides done/partial/left, shared by the runway and the card detail so they can't disagree.
 * A benefit with no dollar value can't be spent down, so any entry finishes it. One with a
 * value is finished only when the amount reaches it; a zero entry is treated as nothing used
 * rather than a partial, and a negative one can't manufacture runway beyond the full value.
 */
export function settleRedemption(
  value: number | null,
  amount: number | null,
): Pick<RunwayItem, 'redeemed' | 'partial' | 'remaining'> {
  if (amount === null) return { redeemed: false, partial: false, remaining: value };
  if (value === null) return { redeemed: true, partial: false, remaining: null };
  const used = Math.max(0, amount);
  const remaining = Math.max(0, value - used);
  return { redeemed: remaining === 0, partial: used > 0 && remaining > 0, remaining };
}

/** All enabled benefits belonging to the active profile's cards, resolved for the current period. */
export function runwayItems(state: State, profileId: string, now: Date = new Date()): RunwayItem[] {
  const cardsById = new Map(cardsForProfile(state, profileId, now).map((c) => [c.id, c]));
  const items: RunwayItem[] = [];
  for (const benefit of state.benefits) {
    if (benefit.enabled === false) continue;
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
      redeemedAmount,
      ...settleRedemption(value, redeemedAmount),
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

/** Fully-used items land in `done`; partials stay in their days-left bucket, each sorted soonest-first. */
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

export interface LedgerEntry {
  periodKey: string;
  amount: number;
}

/**
 * Every ledger entry for a benefit whose period key its current cadence and anchor can no
 * longer produce — the residue of editing a benefit after logging against it. These show up
 * in no period view but still count toward break-even, so they need a way out of the ledger.
 */
export function unscheduledEntries(state: State, benefitId: string): LedgerEntry[] {
  const benefit = state.benefits.find((b) => b.id === benefitId);
  if (!benefit) return [];
  const card = state.cards.find((c) => c.id === benefit.cardId) ?? null;
  const entries: LedgerEntry[] = [];
  for (const [key, amount] of Object.entries(state.redemptions)) {
    const [id, periodKey] = key.split('|');
    if (id === benefitId && !isScheduledPeriodKey(benefit, card, periodKey)) {
      entries.push({ periodKey, amount });
    }
  }
  return entries.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
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
