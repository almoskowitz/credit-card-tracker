import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { defaultState, type State } from './schema';
import { NON_MUTATING_ACTION_TYPES, reduceState, type Action } from './actions';
import { configureStorage, getConnectionStatus, save } from '../storage/api';

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

export interface ToastHandler {
  (message: string): void;
}

/**
 * `initialState` is resolved by the caller before mounting -- `load()` then either the
 * server's state or `defaultState()` -- so the reducer itself never performs I/O. Once
 * mounted, this wires the storage shim's callbacks to dispatch and saves on every dirty
 * state change; no component calls `save()` directly.
 */
export function StoreProvider({
  initialState,
  onToast,
  children,
}: {
  initialState: State;
  onToast?: ToastHandler;
  children: ReactNode;
}) {
  const [store, dispatch] = useReducer(storeReducer, {
    data: initialState,
    connection: getConnectionStatus(),
    dirty: false,
  } satisfies StoreState);

  useEffect(() => {
    configureStorage({
      // `state` is null when the server has never persisted a row -- still a real
      // replace, not a no-op: a save that failed before that first row existed must roll
      // back to nothing, the same as it would to the server's actual row otherwise.
      onReplaceState: (state) => {
        dispatch({ type: 'REPLACE_STATE', state: state ?? defaultState() });
      },
      onConnectionChange: (status) => dispatch({ type: '__SET_CONNECTION', status }),
      onToast: (message) => onToast?.(message),
    });
  }, [onToast]);

  useEffect(() => {
    if (!store.dirty) return;
    save(store.data);
    dispatch({ type: '__ACK_SAVE' });
  }, [store.data, store.dirty]);

  return <StoreContext.Provider value={{ store, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
