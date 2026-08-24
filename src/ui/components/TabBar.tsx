import './TabBar.css';

export type TabId = 'today' | 'wallet' | 'insights' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: JSX.Element;
}

const TABS: Tab[] = [
  {
    id: 'today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 7v5l3 2" />
        <circle cx="12" cy="12" r="8.5" />
      </svg>
    ),
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <path d="M3 10h18" />
        <path d="M16.5 14.5h1.5" />
      </svg>
    ),
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M5 19V11" />
        <path d="M12 19V5" />
        <path d="M19 19v-6" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

interface TabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

/** Four tabs, safe-area padded. Active state is a text-color shift only — no accent colour is spent decoratively. */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab${tab.id === active ? ' active' : ''}`}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
