import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { defaultState, normalizeState, type State } from './state/schema';
import { load } from './storage/api';
import { ToastProvider, useToast } from './ui/components/Toast';
import { TabBar, type TabId } from './ui/components/TabBar';
import { Today } from './ui/views/Today';
import { Wallet } from './ui/views/Wallet';
import { Insights } from './ui/views/Insights';
import { Settings } from './ui/views/Settings';
import { loadViewPrefs, saveViewPrefs } from './ui/viewPrefs';
import './ui/tokens.css';
import './App.css';

/**
 * The `import.meta.env.DEV` check wraps the dynamic import directly (not a helper function
 * call) so esbuild's production minify pass can fold `if (false)` and drop this whole branch
 * — `./ui/devSeed` and its `data/cards.json` import never reach the shipped bundle. Verified
 * by grepping `dist/index.html` for catalog slugs after a prod build.
 */
async function resolveInitialState(): Promise<State> {
  let state: State;
  try {
    const result = await load();
    state = result.state ?? defaultState();
  } catch {
    state = defaultState();
  }
  // The server stores/returns a raw JSON blob with no schema validation -- a row saved before
  // this feature shipped won't have rewardCurrencies at all, so it's backfilled here. (The
  // reducer's REPLACE_STATE case does the same for 409 recovery / foreground refresh.)
  state = normalizeState(state);
  if (import.meta.env.DEV && state.cards.length === 0 && new URLSearchParams(location.search).has('seed')) {
    const { devSeed } = await import('./ui/devSeed');
    state = await devSeed(state);
  }
  return state;
}

function ConnectionBanner() {
  const { store } = useStore();
  if (store.connection !== 'unreachable') return null;
  return (
    <div className="connection-banner" role="status">
      Can&rsquo;t reach the server — editing is paused until it&rsquo;s back.
    </div>
  );
}

function AppShell() {
  const { store } = useStore();
  const [tab, setTab] = useState<TabId>(() => loadViewPrefs().tab);
  const [activeProfileId, setActiveProfileId] = useState<string>(
    () => loadViewPrefs().activeProfileId ?? store.data.profiles[0]?.id ?? '',
  );

  // A stored profile id that no longer exists (deleted, or from a stale export) falls back to
  // the first profile rather than rendering an empty wallet or throwing.
  useEffect(() => {
    if (store.data.profiles.some((p) => p.id === activeProfileId)) return;
    setActiveProfileId(store.data.profiles[0]?.id ?? '');
  }, [store.data.profiles, activeProfileId]);

  useEffect(() => {
    saveViewPrefs({ tab, activeProfileId });
  }, [tab, activeProfileId]);

  function cycleProfile() {
    const ids = store.data.profiles.map((p) => p.id);
    if (ids.length < 2) return;
    const idx = ids.indexOf(activeProfileId);
    setActiveProfileId(ids[(idx + 1) % ids.length]);
  }

  return (
    <div className="app-shell">
      <ConnectionBanner />
      <div className="app-scroll">
        {tab === 'today' && <Today profileId={activeProfileId} onProfileTap={cycleProfile} />}
        {tab === 'wallet' && <Wallet profileId={activeProfileId} />}
        {tab === 'insights' && <Insights profileId={activeProfileId} onProfileTap={cycleProfile} />}
        {tab === 'settings' && <Settings activeProfileId={activeProfileId} onSetActiveProfile={setActiveProfileId} />}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}

function Root() {
  const [initial, setInitial] = useState<State | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    resolveInitialState().then((state) => {
      if (!cancelled) setInitial(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!initial) {
    return <div className="app-loading">Loading…</div>;
  }

  return (
    <StoreProvider initialState={initial} onToast={(message) => showToast(message)}>
      <AppShell />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
