import type { Benefit, Cap, Card, EarnRate, Msr, Profile, RewardCurrency, SpendCategory, State } from './schema';
import { ledgerKey } from '../engine/period';

export type Action =
  | { type: 'REPLACE_STATE'; state: State }
  | { type: 'IMPORT_STATE'; state: State }
  | { type: 'ADD_PROFILE'; profile: Profile }
  | { type: 'RENAME_PROFILE'; id: string; name: string }
  | { type: 'DELETE_PROFILE'; id: string }
  | { type: 'ADD_CARD'; card: Card }
  | { type: 'UPDATE_CARD'; id: string; patch: Partial<Omit<Card, 'id'>> }
  | { type: 'DELETE_CARD'; id: string }
  | { type: 'ADD_BENEFIT'; benefit: Benefit }
  | { type: 'UPDATE_BENEFIT'; id: string; patch: Partial<Omit<Benefit, 'id' | 'cardId'>> }
  | { type: 'DELETE_BENEFIT'; id: string }
  | { type: 'SET_REDEMPTION'; benefitId: string; periodKey: string; amount: number }
  | { type: 'DELETE_REDEMPTION'; benefitId: string; periodKey: string }
  | { type: 'ADD_CAP'; cap: Cap }
  | { type: 'UPDATE_CAP'; id: string; patch: Partial<Omit<Cap, 'id' | 'cardId'>> }
  | { type: 'DELETE_CAP'; id: string }
  | { type: 'ADD_MSR'; msr: Msr }
  | { type: 'UPDATE_MSR'; id: string; patch: Partial<Omit<Msr, 'id' | 'cardId'>> }
  | { type: 'DELETE_MSR'; id: string }
  | { type: 'ADD_CATEGORY'; category: SpendCategory }
  | { type: 'UPDATE_CATEGORY'; id: string; patch: Partial<Omit<SpendCategory, 'id'>> }
  | { type: 'DELETE_CATEGORY'; id: string }
  | { type: 'SET_SPEND'; month: string; categoryId: string; amount: number }
  | { type: 'ADD_EARN_RATE'; earnRate: EarnRate }
  | { type: 'UPDATE_EARN_RATE'; id: string; patch: Partial<Omit<EarnRate, 'id' | 'cardId'>> }
  | { type: 'DELETE_EARN_RATE'; id: string }
  | { type: 'ADD_REWARD_CURRENCY'; rewardCurrency: RewardCurrency }
  | { type: 'UPDATE_REWARD_CURRENCY'; id: string; patch: Partial<Omit<RewardCurrency, 'id'>> };

/** REPLACE_STATE is system-driven (load, 409 recovery, foreground refresh) — never a user mutation. */
export const NON_MUTATING_ACTION_TYPES: ReadonlySet<Action['type']> = new Set(['REPLACE_STATE']);

function without<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

function patchById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function withoutRedemptionsFor(redemptions: State['redemptions'], benefitIds: ReadonlySet<string>): State['redemptions'] {
  const next: State['redemptions'] = {};
  for (const [key, amount] of Object.entries(redemptions)) {
    const [benefitId] = key.split('|');
    if (!benefitIds.has(benefitId)) next[key] = amount;
  }
  return next;
}

/**
 * The pure state reducer: (State, Action) -> State. No I/O, no clock, no random source, no
 * mutation of its input. Every id or timestamp an action needs travels in the action payload.
 */
export function reduceState(state: State, action: Action): State {
  switch (action.type) {
    case 'REPLACE_STATE':
      return action.state;

    // A user-initiated whole-blob import: unlike REPLACE_STATE, this IS a mutation — it goes
    // through the connection guard and triggers exactly one PUT, same as any other edit.
    case 'IMPORT_STATE':
      return action.state;

    case 'ADD_PROFILE':
      return { ...state, profiles: [...state.profiles, action.profile] };

    case 'RENAME_PROFILE':
      return { ...state, profiles: patchById(state.profiles, action.id, { name: action.name }) };

    case 'DELETE_PROFILE': {
      if (state.profiles.length <= 1) return state; // the last profile cannot be deleted
      if (state.cards.some((c) => c.profileId === action.id)) return state; // cards must be resolved first
      return { ...state, profiles: without(state.profiles, action.id) };
    }

    case 'ADD_CARD':
      return { ...state, cards: [...state.cards, action.card] };

    case 'UPDATE_CARD':
      return { ...state, cards: patchById<Card>(state.cards, action.id, action.patch) };

    case 'DELETE_CARD': {
      const cardId = action.id;
      const removedBenefitIds = new Set(state.benefits.filter((b) => b.cardId === cardId).map((b) => b.id));
      return {
        ...state,
        cards: without(state.cards, cardId),
        benefits: state.benefits.filter((b) => b.cardId !== cardId),
        caps: state.caps.filter((c) => c.cardId !== cardId),
        msrs: state.msrs.filter((m) => m.cardId !== cardId),
        earnRates: state.earnRates.filter((e) => e.cardId !== cardId),
        redemptions: withoutRedemptionsFor(state.redemptions, removedBenefitIds),
      };
    }

    case 'ADD_BENEFIT':
      return { ...state, benefits: [...state.benefits, action.benefit] };

    case 'UPDATE_BENEFIT':
      return { ...state, benefits: patchById<Benefit>(state.benefits, action.id, action.patch) };

    case 'DELETE_BENEFIT':
      return {
        ...state,
        benefits: without(state.benefits, action.id),
        redemptions: withoutRedemptionsFor(state.redemptions, new Set([action.id])),
      };

    case 'SET_REDEMPTION': {
      const key = ledgerKey(action.benefitId, action.periodKey);
      return { ...state, redemptions: { ...state.redemptions, [key]: action.amount } };
    }

    case 'DELETE_REDEMPTION': {
      const key = ledgerKey(action.benefitId, action.periodKey);
      const { [key]: _removed, ...rest } = state.redemptions;
      return { ...state, redemptions: rest };
    }

    case 'ADD_CAP':
      return { ...state, caps: [...state.caps, action.cap] };

    case 'UPDATE_CAP':
      return { ...state, caps: patchById<Cap>(state.caps, action.id, action.patch) };

    case 'DELETE_CAP':
      return { ...state, caps: without(state.caps, action.id) };

    case 'ADD_MSR':
      return { ...state, msrs: [...state.msrs, action.msr] };

    case 'UPDATE_MSR':
      return { ...state, msrs: patchById<Msr>(state.msrs, action.id, action.patch) };

    case 'DELETE_MSR':
      return { ...state, msrs: without(state.msrs, action.id) };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.category] };

    case 'UPDATE_CATEGORY':
      return { ...state, categories: patchById<SpendCategory>(state.categories, action.id, action.patch) };

    case 'DELETE_CATEGORY':
      return { ...state, categories: without(state.categories, action.id) };

    case 'SET_SPEND': {
      const month = { ...(state.spend[action.month] ?? {}), [action.categoryId]: action.amount };
      return { ...state, spend: { ...state.spend, [action.month]: month } };
    }

    case 'ADD_EARN_RATE':
      return { ...state, earnRates: [...state.earnRates, action.earnRate] };

    case 'UPDATE_EARN_RATE':
      return { ...state, earnRates: patchById<EarnRate>(state.earnRates, action.id, action.patch) };

    case 'DELETE_EARN_RATE':
      return { ...state, earnRates: without(state.earnRates, action.id) };

    case 'ADD_REWARD_CURRENCY':
      return { ...state, rewardCurrencies: [...state.rewardCurrencies, action.rewardCurrency] };

    case 'UPDATE_REWARD_CURRENCY':
      return { ...state, rewardCurrencies: patchById<RewardCurrency>(state.rewardCurrencies, action.id, action.patch) };

    default:
      return state;
  }
}
