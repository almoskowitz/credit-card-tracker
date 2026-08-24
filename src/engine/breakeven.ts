import type { Cadence } from './period';

export interface BreakevenBenefit {
  id: string;
  cardId: string;
  value: number | null;
  cadence: Cadence;
  valueOverrides?: Record<string, number> | null;
}

export interface BreakevenCard {
  id: string;
  fee: number | null;
}

export interface Breakeven {
  recovered: number;
  potential: number;
  recoveryPct: number;
  netCost: number;
}

function cadenceSuffixes(cadence: Cadence): (string | null)[] {
  if (cadence === 'monthly') return Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
  if (cadence === 'quarterly') return ['Q1', 'Q2', 'Q3', 'Q4'];
  if (cadence === 'semiannual') return ['H1', 'H2'];
  return [null]; // annual: single period, overrides ignored entirely
}

export function potentialAnnualValue(benefit: BreakevenBenefit): number {
  let total = 0;
  for (const suffix of cadenceSuffixes(benefit.cadence)) {
    const v = suffix && benefit.valueOverrides && suffix in benefit.valueOverrides
      ? benefit.valueOverrides[suffix]
      : benefit.value;
    if (v !== null) total += v;
  }
  return total;
}

function yearOfPeriodKey(periodKey: string): number {
  const s = periodKey.startsWith('A') ? periodKey.slice(1) : periodKey;
  return Number(s.slice(0, 4));
}

function recoveredForBenefits(
  benefitIds: Set<string>,
  redemptions: Record<string, number>,
  year: number,
): number {
  let recovered = 0;
  for (const [ledgerKey, amount] of Object.entries(redemptions)) {
    const [benefitId, periodKey] = ledgerKey.split('|');
    if (benefitIds.has(benefitId) && yearOfPeriodKey(periodKey) === year) {
      recovered += amount;
    }
  }
  return recovered;
}

function computeBreakeven(fee: number | null, recovered: number, potential: number): Breakeven {
  const f = fee ?? 0;
  const recoveryPct = f > 0 ? Math.min(100, (recovered / f) * 100) : 0;
  const netCost = Math.max(0, f - recovered);
  return { recovered, potential, recoveryPct, netCost };
}

export function cardBreakeven(
  card: BreakevenCard,
  benefits: BreakevenBenefit[],
  redemptions: Record<string, number>,
  now: Date = new Date(),
): Breakeven {
  const cardBenefits = benefits.filter((b) => b.cardId === card.id);
  const recovered = recoveredForBenefits(new Set(cardBenefits.map((b) => b.id)), redemptions, now.getFullYear());
  const potential = cardBenefits.reduce((sum, b) => sum + potentialAnnualValue(b), 0);
  return computeBreakeven(card.fee, recovered, potential);
}

export interface PortfolioBreakeven extends Breakeven {
  totalFees: number;
}

export function portfolioBreakeven(
  cards: BreakevenCard[],
  benefits: BreakevenBenefit[],
  redemptions: Record<string, number>,
  now: Date = new Date(),
): PortfolioBreakeven {
  let totalFees = 0;
  let recovered = 0;
  let potential = 0;
  for (const card of cards) {
    const cb = cardBreakeven(card, benefits, redemptions, now);
    totalFees += card.fee ?? 0;
    recovered += cb.recovered;
    potential += cb.potential;
  }
  return { totalFees, ...computeBreakeven(totalFees, recovered, potential) };
}
