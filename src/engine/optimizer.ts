export interface EarnRate {
  category: string;
  rate: number;
}

export interface OptimizerCard {
  id: string;
  earnRates: EarnRate[];
}

export type Spend = Record<string, Record<string, number>>;

export function effectiveRate(card: OptimizerCard, category: string): number {
  const exact = card.earnRates.find((r) => r.category === category);
  if (exact) return exact.rate;
  const fallback = card.earnRates.find((r) => r.category === 'everything-else');
  if (fallback) return fallback.rate;
  return 1;
}

export function bestCardForCategory(
  cards: OptimizerCard[],
  category: string,
): { card: OptimizerCard; rate: number } | null {
  let best: { card: OptimizerCard; rate: number } | null = null;
  for (const card of cards) {
    const rate = effectiveRate(card, category);
    if (!best || rate > best.rate) best = { card, rate };
  }
  return best;
}

function annualSpendByCategory(spend: Spend): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const month of Object.values(spend)) {
    for (const [category, amount] of Object.entries(month)) {
      totals[category] = (totals[category] ?? 0) + amount;
    }
  }
  return totals;
}

export function optimalWallet(cards: OptimizerCard[], spend: Spend, size: number): OptimizerCard[] {
  const hasSpend = Object.keys(spend).length > 0;
  const scored = hasSpend
    ? scoreBySpend(cards, annualSpendByCategory(spend))
    : scoreByRateSum(cards);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map((s) => s.card);
}

function scoreBySpend(cards: OptimizerCard[], totals: Record<string, number>) {
  return cards.map((card) => ({
    card,
    score: Object.entries(totals).reduce((sum, [category, amount]) => sum + amount * effectiveRate(card, category), 0),
  }));
}

function scoreByRateSum(cards: OptimizerCard[]) {
  return cards.map((card) => ({
    card,
    score: card.earnRates.reduce((sum, r) => sum + r.rate, 0),
  }));
}
