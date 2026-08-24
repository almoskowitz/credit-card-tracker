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
}

export type Redemptions = Record<string, number>; // "<benefitId>|<periodKey>" -> amount

export interface Cap {
  id: string;
  cardId: string;
  name: string;
  cadence: Cadence;
  limit: number;
  used: number;
  periodKey: string;
}

export interface Msr {
  id: string;
  cardId: string;
  label: string;
  requirement: number;
  deadline: string; // "YYYY-MM-DD"
  spent: number;
  bonusValue: number | null;
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

  return obj as unknown as State;
}
