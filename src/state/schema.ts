import type { Cadence } from '../engine/period';

export type Anchor = 'calendar' | 'anniversary';

export interface Profile {
  id: string;
  name: string;
}

export interface Card {
  id: string;
  profileId: string;
  slug: string | null;
  name: string;
  issuer: string;
  fee: number | null;
  anniversary: string | null; // "YYYY-MM-DD"
  opened: string | null; // "YYYY-MM-DD"
  closed: string | null; // "YYYY-MM-DD"
  rewardCurrency: string | null; // RewardCurrency id; null/missing treated as "cash"
}

/** A point/mile program's estimated value. centsPerPoint is a user-editable estimate, not a fact. */
export interface RewardCurrency {
  id: string;
  name: string;
  centsPerPoint: number;
}

export interface Benefit {
  id: string;
  cardId: string;
  name: string;
  value: number | null;
  displayValue: string | null;
  valueOverrides: Record<string, number> | null;
  cadence: Cadence;
  anchor: Anchor;
  category: string;
  notes: string | null;
  /** Annual spend that earns this benefit (a free-night cert at $15k); null = granted outright. */
  unlockSpend: number | null;
  /** false = not earned / not tracked: leaves the runway and both sides of break-even. */
  enabled: boolean;
}

/**
 * "<benefitId>|<periodKey>" -> amount USED so far in that period, not a completion flag. A
 * $75 charge against a $300 credit stores 75 and the credit stays on the runway with $225
 * left; it counts as done only once the amount reaches the benefit's value.
 */
export type Redemptions = Record<string, number>;

export interface Cap {
  id: string;
  cardId: string;
  name: string;
  cadence: Cadence;
  limit: number;
  used: number;
  periodKey: string;
}

export interface BonusComponent {
  id: string;
  label: string;
  value: number | null;
  unit: string; // free-text — "cash", "points", "miles", "cert", etc. Formatted as usd() only when "cash".
}

export interface Msr {
  id: string;
  cardId: string;
  label: string;
  requirement: number;
  deadline: string; // "YYYY-MM-DD"
  spent: number;
  bonuses: BonusComponent[];
  notes: string | null;
}

export interface SpendCategory {
  id: string;
  name: string;
  budget: number | null;
}

export type Spend = Record<string, Record<string, number>>; // "YYYY-MM" -> categoryId -> amount

export interface EarnRate {
  id: string;
  cardId: string;
  category: string;
  rate: number;
  notes: string | null;
}

export interface State {
  schemaVersion: 2;
  profiles: Profile[];
  cards: Card[];
  benefits: Benefit[];
  redemptions: Redemptions;
  caps: Cap[];
  msrs: Msr[];
  categories: SpendCategory[];
  spend: Spend;
  earnRates: EarnRate[];
  rewardCurrencies: RewardCurrency[];
}

export const SEED_CATEGORY_NAMES = [
  'Dining',
  'Supermarkets',
  'Gas Stations',
  'Travel',
  'Hotels',
  'Flights',
  'Office Supply',
  'Internet / Cable / Phone',
  'Shipping',
  'Drugstores',
  'Rideshare',
  'Streaming',
  'Everything Else',
  'Other',
] as const;

// Seed cents-per-point estimates, roughly in line with published TPG/NerdWallet-style
// valuations at the time this feature shipped (2026). These are DEFAULTS the user can edit
// in Settings, not claimed as objectively correct.
const SEED_REWARD_CURRENCIES: readonly RewardCurrency[] = [
  { id: 'cash', name: 'Cash', centsPerPoint: 1.0 },
  { id: 'membership-rewards', name: 'Amex Membership Rewards', centsPerPoint: 2.0 },
  { id: 'ultimate-rewards', name: 'Chase Ultimate Rewards', centsPerPoint: 2.0 },
  { id: 'capital-one-miles', name: 'Capital One Miles', centsPerPoint: 1.85 },
  { id: 'citi-thankyou', name: 'Citi ThankYou Points', centsPerPoint: 1.9 },
  { id: 'hilton-honors', name: 'Hilton Honors', centsPerPoint: 0.5 },
  { id: 'world-of-hyatt', name: 'World of Hyatt', centsPerPoint: 1.7 },
  { id: 'marriott-bonvoy', name: 'Marriott Bonvoy', centsPerPoint: 0.7 },
  { id: 'delta-skymiles', name: 'Delta SkyMiles', centsPerPoint: 1.2 },
  { id: 'jetblue-trueblue', name: 'JetBlue TrueBlue', centsPerPoint: 1.3 },
  { id: 'atmos-rewards', name: 'Atmos Rewards', centsPerPoint: 1.4 },
  { id: 'aadvantage', name: 'American AAdvantage', centsPerPoint: 1.4 },
];

/** A fresh, independently-mutable copy of the seed reward-currency list. */
export function defaultRewardCurrencies(): RewardCurrency[] {
  return SEED_REWARD_CURRENCIES.map((c) => ({ ...c }));
}

/** A benefit stored before `unlockSpend`/`enabled` existed is an ordinary always-granted one. */
function normalizeBenefit(benefit: Benefit): Benefit {
  if (typeof benefit.enabled === 'boolean' && 'unlockSpend' in benefit) return benefit;
  return { ...benefit, unlockSpend: benefit.unlockSpend ?? null, enabled: benefit.enabled ?? true };
}

/**
 * Backfills fields added after a state blob may have been written -- GET /api/state returns
 * whatever JSON is stored, unvalidated, so a row saved before a feature shipped won't carry
 * its fields. Called at every point server state enters the store (initial load, 409
 * recovery, foreground refresh) so no read site has to guard for them.
 */
export function normalizeState(state: State): State {
  return {
    ...state,
    rewardCurrencies: Array.isArray(state.rewardCurrencies) ? state.rewardCurrencies : defaultRewardCurrencies(),
    benefits: Array.isArray(state.benefits) ? state.benefits.map(normalizeBenefit) : state.benefits,
  };
}

export function defaultState(): State {
  const profileId = crypto.randomUUID();
  return {
    schemaVersion: 2,
    profiles: [{ id: profileId, name: 'Personal' }],
    cards: [],
    benefits: [],
    redemptions: {},
    caps: [],
    msrs: [],
    categories: SEED_CATEGORY_NAMES.map((name) => ({ id: crypto.randomUUID(), name, budget: null })),
    spend: {},
    earnRates: [],
    rewardCurrencies: defaultRewardCurrencies(),
  };
}

export class SchemaVersionError extends Error {
  constructor(public found: unknown, public expected: 2) {
    super(`State schema version mismatch: found ${JSON.stringify(found)}, expected ${expected}`);
    this.name = 'SchemaVersionError';
  }
}

const COLLECTION_ARRAY_KEYS = ['profiles', 'cards', 'benefits', 'caps', 'msrs', 'categories', 'earnRates'] as const;
const COLLECTION_OBJECT_KEYS = ['redemptions', 'spend'] as const;

/**
 * Validates that `data` conforms to the v2 state shape. Throws SchemaVersionError when
 * schemaVersion is present but not 2 (per state-schema spec: refuse, don't convert). Throws
 * a plain Error for any other structural violation.
 */
export function validateState(data: unknown): State {
  if (typeof data !== 'object' || data === null) {
    throw new Error('State must be an object');
  }
  const obj = data as Record<string, unknown>;

  if (obj.schemaVersion !== 2) {
    throw new SchemaVersionError(obj.schemaVersion, 2);
  }

  for (const key of COLLECTION_ARRAY_KEYS) {
    if (!Array.isArray(obj[key])) {
      throw new Error(`State.${key} must be an array`);
    }
  }
  for (const key of COLLECTION_OBJECT_KEYS) {
    if (typeof obj[key] !== 'object' || obj[key] === null || Array.isArray(obj[key])) {
      throw new Error(`State.${key} must be an object`);
    }
  }

  // rewardCurrencies predates schemaVersion 2 users of this app but postdates schemaVersion 2
  // itself -- an export made before this feature shipped is still valid v2 state, so a missing
  // array is backfilled with the seed list rather than rejected.
  if ('rewardCurrencies' in obj && !Array.isArray(obj.rewardCurrencies)) {
    throw new Error('State.rewardCurrencies must be an array');
  }
  return normalizeState(obj as unknown as State);
}
