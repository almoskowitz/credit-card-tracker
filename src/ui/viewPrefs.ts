import type { TabId } from './components/TabBar';

const KEY = 'card-tracker:view-prefs';
const TABS: TabId[] = ['today', 'wallet', 'insights', 'settings'];

export interface ViewPrefs {
  tab: TabId;
  activeProfileId: string | null;
}

const DEFAULT_PREFS: ViewPrefs = { tab: 'today', activeProfileId: null };

/**
 * Per-device view state only — the last tab and active profile, never app data. Degrades
 * silently to the default on a missing key, malformed JSON, or a disabled/quota-full store.
 */
export function loadViewPrefs(): ViewPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
    const tab = TABS.includes(parsed.tab as TabId) ? (parsed.tab as TabId) : DEFAULT_PREFS.tab;
    const activeProfileId = typeof parsed.activeProfileId === 'string' ? parsed.activeProfileId : null;
    return { tab, activeProfileId };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveViewPrefs(prefs: ViewPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing / quota exceeded — view prefs are a convenience, not data worth failing over.
  }
}
