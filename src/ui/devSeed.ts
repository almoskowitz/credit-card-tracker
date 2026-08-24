import type { State } from '../state/schema';
import { reduceState } from '../state/actions';
import { copyCardFromCatalog, type Catalog } from '../catalog/catalog';

interface SyntheticMsr {
  slug: string;
  label: string;
  requirement: number;
  spent: number;
  daysOut: number;
}

const SYNTHETIC_MSRS: SyntheticMsr[] = [
  { slug: 'chase-sapphire-reserve', label: '60,000 UR bonus', requirement: 5000, spent: 2180, daysOut: 42 },
  { slug: 'amex-gold', label: '60,000 MR bonus', requirement: 6000, spent: 4650, daysOut: 87 },
];

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * DEV-ONLY visual seed for Phase 4 review, never shipped: `import.meta.env.DEV` is
 * statically `false` after `vite build`, so this whole module's call site (including the
 * dynamic import below) is dead-code eliminated from the production bundle. It builds the
 * seeded state purely via `reduceState`, never `dispatch`, so it never marks the store
 * dirty or triggers a save to a real server on its own — only a subsequent user action does.
 */
export async function devSeed(state: State): Promise<State> {
  if (!import.meta.env.DEV) return state; // belt-and-suspenders: the caller already gates the dynamic import that reaches this module
  const profileId = state.profiles[0]?.id;
  if (!profileId) return state;

  const catalogModule = await import('../../data/cards.json');
  const catalog = catalogModule.default as unknown as Catalog;
  const slugs = ['amex-platinum', 'amex-gold', 'chase-sapphire-reserve', 'hilton-honors-aspire'];
  const chosen = catalog.cards.filter((c) => slugs.includes(c.slug));

  let next = state;
  const cardIdBySlug = new Map<string, string>();

  for (const catalogCard of chosen) {
    const { card, benefits, earnRates } = copyCardFromCatalog(catalogCard, profileId);
    cardIdBySlug.set(catalogCard.slug, card.id);
    next = reduceState(next, { type: 'ADD_CARD', card });
    for (const benefit of benefits) next = reduceState(next, { type: 'ADD_BENEFIT', benefit });
    for (const earnRate of earnRates) next = reduceState(next, { type: 'ADD_EARN_RATE', earnRate });
  }

  for (const msr of SYNTHETIC_MSRS) {
    const cardId = cardIdBySlug.get(msr.slug);
    if (!cardId) continue;
    next = reduceState(next, {
      type: 'ADD_MSR',
      msr: {
        id: crypto.randomUUID(),
        cardId,
        label: msr.label,
        requirement: msr.requirement,
        deadline: isoDaysFromNow(msr.daysOut),
        spent: msr.spent,
        bonusValue: null,
        notes: null,
      },
    });
  }

  return next;
}
