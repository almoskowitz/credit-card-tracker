import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { State } from './schema';
import { NON_MUTATING_ACTION_TYPES, reduceState, type Action } from './actions';

export type ConnectionStatus = 'online' | 'unreachable';

export interface StoreState {
  data: State;
  connection: ConnectionStatus;
  dirty: boolean;
}

export type StoreAction = Action | { type: '__SET_CONNECTION'; status: ConnectionStatus } | { type: '__ACK_SAVE' };

/**
 * Wraps the pure data reducer with the connection guard and the dirty flag. Mutations are
 * rejected here — a single check at the boundary — whenever the connection is unreachable,
 * so no component can bypass the block by forgetting to check connection state itself.
 */
export function storeReducer(store: StoreState, action: StoreAction): StoreState {
  if (action.type === '__SET_CONNECTION') {
    return { ...store, connection: action.status };
  }
  if (action.type === '__ACK_SAVE') {
    return { ...store, dirty: false };
  }
  if (NON_MUTATING_ACTION_TYPES.has(action.type)) {
    return { ...store, data: reduceState(store.data, action), dirty: false };
  }
  if (store.connection === 'unreachable') {
    return store;
  }
  const data = reduceState(store.data, action);
  if (data === store.data) return store;
  return { ...store, data, dirty: true };
}

interface StoreContextValue {
  store: StoreState;
  dispatch: Dispatch<StoreAction>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ initialState, children }: { initialState: State; children: ReactNode }) {
  const [store, dispatch] = useReducer(storeReducer, {
    data: initialState,
    connection: 'online',
    dirty: false,
  } satisfies StoreState);

  return <StoreContext.Provider value={{ store, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
