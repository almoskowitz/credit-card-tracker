import type { State } from '../state/schema';

/**
 * The client-side persistence shim. Everything above this file talks to `load()` / `save()`
 * / `flush()` and never touches `fetch`, a status code, or `/api/` directly -- see
 * storage-sync/spec.md. There is no local data fallback anywhere in this module: an edit
 * made while unreachable is never queued or replayed, only ever applied in memory and lost
 * if it can't reach the server before the tab closes.
 */

const DEBOUNCE_MS = 750;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

export type ConnectionStatus = 'online' | 'unreachable';

export interface StorageCallbacks {
  /** 409 recovery, initial load, and foreground/backoff refresh all funnel through here. */
  onReplaceState: (state: State | null, updatedAt: string | null) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
  onToast: (message: string) => void;
}

let callbacks: StorageCallbacks | null = null;
let knownUpdatedAt: string | null = null;
let pendingState: State | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = BACKOFF_START_MS;
let connection: ConnectionStatus = 'online';
let recoveryInFlight = false;

export function configureStorage(cb: StorageCallbacks): void {
  callbacks = cb;
}

export function getConnectionStatus(): ConnectionStatus {
  return connection;
}

/** The server's `updatedAt` from the most recent successful GET or PUT — Settings' "last synced" display. */
export function getLastSyncedAt(): string | null {
  return knownUpdatedAt;
}

function setConnection(status: ConnectionStatus): void {
  if (connection === status) return;
  connection = status;
  callbacks?.onConnectionChange(status);
}

export async function load(): Promise<{ updatedAt: string | null; state: State | null }> {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
  const data = (await res.json()) as { updatedAt: string | null; state: State | null };
  knownUpdatedAt = data.updatedAt;
  setConnection('online');
  return data;
}

/** Debounced, fire-and-forget. Coalesces at 750ms of quiet -- see PUT commit(). */
export function save(state: State): void {
  pendingState = state;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void commit(false);
  }, DEBOUNCE_MS);
}

/** Synchronous best-effort teardown: issues any pending write immediately, or does nothing. */
export function flush(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (pendingState === null) return;
  void commit(true);
}

/** Manual Retry: short-circuits the backoff and attempts recovery immediately. */
export function retry(): void {
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  void attemptRecovery();
}

async function commit(keepalive: boolean): Promise<void> {
  const state = pendingState;
  if (state === null) return;
  pendingState = null;

  const body = JSON.stringify({ updatedAt: knownUpdatedAt, state });
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive,
    });

    if (res.status === 200) {
      const data = (await res.json()) as { updatedAt: string };
      knownUpdatedAt = data.updatedAt;
      setConnection('online');
      return;
    }

    if (res.status === 409) {
      const data = (await res.json()) as { updatedAt: string | null; state: State | null };
      knownUpdatedAt = data.updatedAt;
      setConnection('online');
      // The rejected write is never retried -- the user's change is gone by design.
      callbacks?.onReplaceState(data.state, data.updatedAt);
      callbacks?.onToast('Refreshed — your view was out of date');
      return;
    }

    handleUnreachable();
  } catch {
    handleUnreachable();
  }
}

function handleUnreachable(): void {
  setConnection('unreachable');
  scheduleBackoff();
}

function scheduleBackoff(): void {
  if (backoffTimer) return;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void attemptRecovery();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
}

async function attemptRecovery(): Promise<boolean> {
  if (recoveryInFlight) return false;
  recoveryInFlight = true;
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
    const data = (await res.json()) as { updatedAt: string | null; state: State | null };
    knownUpdatedAt = data.updatedAt;
    backoffMs = BACKOFF_START_MS;
    setConnection('online');
    callbacks?.onReplaceState(data.state, data.updatedAt);
    return true;
  } catch {
    scheduleBackoff();
    return false;
  } finally {
    recoveryInFlight = false;
  }
}

async function refreshOnForeground(): Promise<void> {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
    const data = (await res.json()) as { updatedAt: string | null; state: State | null };
    setConnection('online');
    // Re-check pendingState after the await: an edit made while this GET was in flight
    // must not be clobbered by a response that started before it existed.
    if (data.updatedAt !== knownUpdatedAt && pendingState === null) {
      knownUpdatedAt = data.updatedAt;
      callbacks?.onReplaceState(data.state, data.updatedAt);
    }
  } catch {
    handleUnreachable();
  }
}

function setupLifecycleListeners(): void {
  if (typeof document === 'undefined') return; // no DOM under vitest/SSR

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    } else if (pendingState === null) {
      void refreshOnForeground();
    }
  });

  window.addEventListener('pagehide', () => {
    flush();
  });
}

setupLifecycleListeners();
