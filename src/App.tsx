import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { defaultState, type State } from './state/schema';
import { load } from './storage/api';
import { ToastProvider, useToast } from './ui/components/Toast';
import { TabBar, type TabId } from './ui/components/TabBar';
import { Today } from './ui/views/Today';
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
      Can&rsquo;t reach the server — changes won&rsquo;t be saved until it&rsquo;s back.
    </div>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="hdr">
      <div>
        <h1>{title}</h1>
        <div className="h-sub">Coming in a later Phase 4 task</div>
      </div>
    </div>
  );
}

function AppShell() {
  const { store } = useStore();
  const [tab, setTab] = useState<TabId>('today');
  const [activeProfileId, setActiveProfileId] = useState<string>(() => store.data.profiles[0]?.id ?? '');

  useEffect(() => {
    if (store.data.profiles.some((p) => p.id === activeProfileId)) return;
    setActiveProfileId(store.data.profiles[0]?.id ?? '');
  }, [store.data.profiles, activeProfileId]);

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
        {tab === 'wallet' && <PlaceholderView title="Wallet" />}
        {tab === 'insights' && <PlaceholderView title="Insights" />}
        {tab === 'settings' && <PlaceholderView title="Settings" />}
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
