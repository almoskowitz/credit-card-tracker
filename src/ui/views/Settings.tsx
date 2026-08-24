import { useRef, useState, type Dispatch } from 'react';
import { useStore, type StoreAction } from '../../state/store';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/Sheet';
import { validateState, type State } from '../../state/schema';
import { getLastSyncedAt, retry } from '../../storage/api';
import cardSchemaMd from '../../../docs/card-schema.md?raw';
import '../../App.css';
import '../shared.css';
import './Settings.css';

function ChevronIcon() {
  return (
    <svg className="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface SettingsProps {
  activeProfileId: string;
  onSetActiveProfile: (id: string) => void;
}

export function Settings({ activeProfileId, onSetActiveProfile }: SettingsProps) {
  const { store, dispatch } = useStore();
  const { showToast } = useToast();
  const state = store.data;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profilesOpen, setProfilesOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ state: State; summary: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setImportError(null);
    setPendingImport(null);
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setImportError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    let validated: State;
    try {
      validated = validateState(parsed);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
      return;
    }
    const redemptionCount = Object.keys(validated.redemptions).length;
    const summary = `${validated.cards.length} card${validated.cards.length === 1 ? '' : 's'} · ${validated.benefits.length} benefit${validated.benefits.length === 1 ? '' : 's'} · ${redemptionCount} redemption${redemptionCount === 1 ? '' : 's'}`;
    setPendingImport({ state: validated, summary });
  }

  function confirmImport() {
    if (!pendingImport) return;
    dispatch({ type: 'IMPORT_STATE', state: pendingImport.state });
    setPendingImport(null);
    showToast('Data replaced from import');
  }

  const connection = store.connection;
  const lastSynced = getLastSyncedAt();
  const activeProfile = state.profiles.find((p) => p.id === activeProfileId);
  const activeProfileCardCount = state.cards.filter((c) => c.profileId === activeProfileId).length;

  return (
    <div>
      <div className="hdr">
        <div>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="list settings-list">
        <button type="button" className="li" onClick={() => setProfilesOpen((v) => !v)}>
          Profiles
          <span className="r">
            {activeProfile?.name ?? '—'} · {activeProfileCardCount} card{activeProfileCardCount === 1 ? '' : 's'}
            <ChevronIcon />
          </span>
        </button>
        {profilesOpen && (
          <div className="settings-panel">
            <ProfileList
              state={state}
              dispatch={dispatch}
              activeProfileId={activeProfileId}
              onSetActiveProfile={onSetActiveProfile}
              showToast={showToast}
            />
          </div>
        )}
        <button type="button" className="li" onClick={exportJson}>
          Export JSON
          <span className="r">
            <ChevronIcon />
          </span>
        </button>
        <button type="button" className="li" onClick={() => fileInputRef.current?.click()}>
          Import JSON
          <span className="r">
            <ChevronIcon />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {importError && <div className="settings-error">{importError}</div>}

      {pendingImport && (
        <div className="settings-panel settings-import-confirm">
          <div className="s">This will replace all current data with the imported file:</div>
          <div className="settings-import-summary">{pendingImport.summary}</div>
          <div className="editor-actions">
            <button type="button" className="chip ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
            <button type="button" className="chip sky" onClick={confirmImport}>
              Replace all data
            </button>
          </div>
        </div>
      )}

      <div className="list settings-list">
        <div className="li li-static">
          Server
          <span className="r">
            <span className={`sdot${connection === 'unreachable' ? ' off' : ''}`} />
            {connection === 'unreachable' ? 'unreachable' : 'connected'}
            {lastSynced ? ` · synced ${timeAgo(lastSynced)}` : ''}
          </span>
        </div>
        {connection === 'unreachable' && (
          <button type="button" className="li" onClick={() => retry()}>
            Retry now
          </button>
        )}
        <button type="button" className="li" onClick={() => setSchemaOpen(true)}>
          How to add cards
          <span className="r">
            Paste-JSON schema
            <ChevronIcon />
          </span>
        </button>
      </div>

      <div className="vfoot">Card Tracker v3 · schema v2{lastSynced ? ` · last sync ${timeAgo(lastSynced)}` : ''}</div>

      <Sheet open={schemaOpen} onClose={() => setSchemaOpen(false)} ariaLabel="Card schema">
        <div className="sheet-top">
          <div>
            <h2>Card schema</h2>
          </div>
          <button type="button" onClick={() => setSchemaOpen(false)}>
            Done
          </button>
        </div>
        <pre className="schema-doc">{cardSchemaMd}</pre>
      </Sheet>
    </div>
  );
}

interface ProfileListProps {
  state: State;
  dispatch: Dispatch<StoreAction>;
  activeProfileId: string;
  onSetActiveProfile: (id: string) => void;
  showToast: (message: string) => void;
}

function ProfileList({ state, dispatch, activeProfileId, onSetActiveProfile, showToast }: ProfileListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');

  function commitRename() {
    if (renamingId && draftName.trim() !== '') {
      dispatch({ type: 'RENAME_PROFILE', id: renamingId, name: draftName.trim() });
    }
    setRenamingId(null);
  }

  function remove(profileId: string) {
    if (state.profiles.length <= 1) {
      showToast("The last profile can't be deleted");
      return;
    }
    if (state.cards.some((c) => c.profileId === profileId)) {
      showToast('Reassign or delete this profile’s cards first');
      return;
    }
    dispatch({ type: 'DELETE_PROFILE', id: profileId });
  }

  function addProfile() {
    if (newName.trim() === '') return;
    const id = crypto.randomUUID();
    dispatch({ type: 'ADD_PROFILE', profile: { id, name: newName.trim() } });
    onSetActiveProfile(id);
    setNewName('');
    setAddingNew(false);
  }

  return (
    <div className="settings-profiles">
      {state.profiles.map((p) => {
        const cardCount = state.cards.filter((c) => c.profileId === p.id).length;
        return (
          <div key={p.id} className="profile-row">
            {renamingId === p.id ? (
              <input
                className="profile-rename-input"
                value={draftName}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                }}
              />
            ) : (
              <button
                type="button"
                className={`profile-name${p.id === activeProfileId ? ' active' : ''}`}
                onClick={() => onSetActiveProfile(p.id)}
              >
                {p.name}
                {p.id === activeProfileId ? ' · active' : ''}
              </button>
            )}
            <span className="profile-count">
              {cardCount} card{cardCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="profile-action"
              onClick={() => {
                setRenamingId(p.id);
                setDraftName(p.name);
              }}
            >
              Rename
            </button>
            <button type="button" className="profile-action danger" onClick={() => remove(p.id)}>
              Delete
            </button>
          </div>
        );
      })}
      {addingNew ? (
        <div className="profile-row">
          <input
            className="profile-rename-input"
            value={newName}
            autoFocus
            placeholder="Profile name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addProfile();
            }}
          />
          <button type="button" className="chip sky" onClick={addProfile}>
            Add
          </button>
        </div>
      ) : (
        <button type="button" className="chip ghost settings-add-profile" onClick={() => setAddingNew(true)}>
          + New profile
        </button>
      )}
    </div>
  );
}
