import { useMemo, useState, type CSSProperties, type Dispatch } from 'react';
import type { StoreAction } from '../../state/store';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { copyCardFromCatalog, type Catalog, type CatalogCard } from '../../catalog/catalog';
import { parseJson, validateCatalogCard } from '../../catalog/importer';
import type { Card } from '../../state/schema';
import catalogData from '../../../data/cards.json';
import { usd, numberInputToValue } from '../format';
import { issuerVar } from '../issuer';
import '../shared.css';
import './CatalogSheet.css';

const CATALOG = catalogData as unknown as Catalog;

function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as unknown as CSSProperties;
}

function capitalize(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

type Tier = 'search' | 'paste' | 'blank';

interface CatalogSheetProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
}

/** The Wallet "+" sheet — search the 24-card catalog, paste a card as JSON, or start blank. */
export function CatalogSheet({ open, onClose, profileId }: CatalogSheetProps) {
  const { dispatch } = useStore();
  const [tier, setTier] = useState<Tier>('search');
  const [query, setQuery] = useState('');

  function close() {
    setQuery('');
    setTier('search');
    onClose();
  }

  function addFromCatalog(catalogCard: CatalogCard) {
    const { card, benefits, earnRates } = copyCardFromCatalog(catalogCard, profileId);
    dispatch({ type: 'ADD_CARD', card });
    for (const b of benefits) dispatch({ type: 'ADD_BENEFIT', benefit: b });
    for (const e of earnRates) dispatch({ type: 'ADD_EARN_RATE', earnRate: e });
    close();
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return CATALOG.cards;
    return CATALOG.cards.filter((c) => c.name.toLowerCase().includes(q) || c.issuer.toLowerCase().includes(q));
  }, [query]);

  return (
    <Sheet open={open} onClose={close} ariaLabel="Add a card">
      <div className="sheet-top">
        <div>
          <h2>Add a card</h2>
        </div>
        <button type="button" onClick={close}>
          Done
        </button>
      </div>

      <div className="cs-tabs">
        <button type="button" className={`cs-tab${tier === 'search' ? ' active' : ''}`} onClick={() => setTier('search')}>
          Search
        </button>
        <button type="button" className={`cs-tab${tier === 'paste' ? ' active' : ''}`} onClick={() => setTier('paste')}>
          Paste JSON
        </button>
        <button type="button" className={`cs-tab${tier === 'blank' ? ' active' : ''}`} onClick={() => setTier('blank')}>
          Blank card
        </button>
      </div>

      {tier === 'search' && <SearchTier query={query} setQuery={setQuery} results={results} onAdd={addFromCatalog} />}
      {tier === 'paste' && <PasteTier onAdd={addFromCatalog} />}
      {tier === 'blank' && <BlankTier profileId={profileId} dispatch={dispatch} onDone={close} />}
    </Sheet>
  );
}

function SearchTier({
  query,
  setQuery,
  results,
  onAdd,
}: {
  query: string;
  setQuery: (q: string) => void;
  results: CatalogCard[];
  onAdd: (card: CatalogCard) => void;
}) {
  return (
    <div className="cs-search">
      <input
        className="cs-search-input"
        placeholder="Search by name or issuer"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="cs-results">
        {results.length === 0 && <div className="cd-empty">No matches.</div>}
        {results.map((c) => (
          <button key={c.slug} type="button" className="cs-result" onClick={() => onAdd(c)}>
            <span className="edge" style={cssVar('--acc', issuerVar(c.issuer))} />
            <div className="cs-result-main">
              <div className="cs-result-name">{c.name}</div>
              <div className="cs-result-sub money">
                {c.issuer}
                {c.annualFee != null ? ` · ${usd(c.annualFee)}/yr` : ' · no annual fee'}
              </div>
            </div>
            <span className="cs-add">Add</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PasteTier({ onAdd }: { onAdd: (card: CatalogCard) => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<CatalogCard | null>(null);

  function validate() {
    setPreview(null);
    const parsed = parseJson(text);
    if (!parsed.ok) {
      setErrors([parsed.error.message]);
      return;
    }
    const result = validateCatalogCard(parsed.value);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(null);
    setPreview(result.value);
  }

  return (
    <div className="cs-paste">
      {!preview && (
        <>
          <textarea
            className="cs-textarea"
            placeholder="Paste a card JSON object here — see Settings -> How to add cards for the schema and the copy-paste prompt."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setErrors(null);
            }}
          />
          {errors && (
            <ul className="cs-errors">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <button type="button" className="chip sky" disabled={text.trim() === ''} onClick={validate}>
            Preview
          </button>
        </>
      )}
      {preview && (
        <div className="cs-preview">
          <div className="cs-preview-name">{preview.name}</div>
          <div className="cs-preview-sub money">
            {preview.issuer} · {preview.annualFee != null ? `${usd(preview.annualFee)}/yr` : 'fee unknown'}
          </div>
          <ul className="cs-preview-benefits">
            {preview.benefits.map((b) => (
              <li key={b.name}>
                <span>{b.name}</span>
                <span className="cs-preview-cadence">{capitalize(b.cadence)}</span>
                <span className="money">{b.value != null ? usd(b.value) : (b.displayValue ?? '—')}</span>
              </li>
            ))}
          </ul>
          <div className="editor-actions">
            <button type="button" className="chip ghost" onClick={() => setPreview(null)}>
              Back
            </button>
            <button type="button" className="chip sky" onClick={() => onAdd(preview)}>
              Add this card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlankTier({ profileId, dispatch, onDone }: { profileId: string; dispatch: Dispatch<StoreAction>; onDone: () => void }) {
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [fee, setFee] = useState('');

  const valid = name.trim() !== '' && issuer.trim() !== '';

  function create() {
    if (!valid) return;
    const card: Card = {
      id: crypto.randomUUID(),
      profileId,
      slug: null,
      name: name.trim(),
      issuer: issuer.trim(),
      fee: numberInputToValue(fee),
      anniversary: null,
      opened: null,
      closed: null,
      rewardCurrency: null,
    };
    dispatch({ type: 'ADD_CARD', card });
    onDone();
  }

  return (
    <div className="cs-blank">
      <label className="editor-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Card" />
      </label>
      <label className="editor-field">
        <span>Issuer</span>
        <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="e.g. Chase" />
      </label>
      <label className="editor-field">
        <span>Annual fee ($)</span>
        <input type="number" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
      </label>
      <div className="editor-actions">
        <button type="button" className="chip sky" disabled={!valid} onClick={create}>
          Add card
        </button>
      </div>
    </div>
  );
}
