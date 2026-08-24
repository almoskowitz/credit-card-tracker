import { useState, type Dispatch } from 'react';
import { useStore, type StoreAction } from '../../state/store';
import { cardBreakevenFor } from '../../state/selectors';
import { ledgerKey, parseLocalDate, periodFor, resolveBenefitValue, type Anchor, type Cadence } from '../../engine/period';
import type { Benefit, Cap, Card, EarnRate, Msr } from '../../state/schema';
import { Sheet } from '../components/Sheet';
import { ProgressBar, type ProgressVariant } from '../components/ProgressBar';
import { CATEGORIES, categoryName } from '../../catalog/categories';
import type { Catalog, CatalogCard } from '../../catalog/catalog';
import catalogData from '../../../data/cards.json';
import { usd, pct, shortDate, monthYear, numberInputToValue } from '../format';
import '../shared.css';
import './CardDetail.css';

const CATALOG = catalogData as unknown as Catalog;
const CADENCES: Cadence[] = ['monthly', 'quarterly', 'semiannual', 'annual'];
const ANCHORS: Anchor[] = ['calendar', 'anniversary'];

function barVariant(recoveryPct: number): ProgressVariant {
  if (recoveryPct >= 85) return 'mint';
  if (recoveryPct >= 50) return 'amber';
  return 'red';
}

function suffixesForCadence(cadence: Cadence): string[] {
  if (cadence === 'monthly') return Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
  if (cadence === 'quarterly') return ['Q1', 'Q2', 'Q3', 'Q4'];
  if (cadence === 'semiannual') return ['H1', 'H2'];
  return [];
}

function capitalize(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function ChevronIcon() {
  return (
    <svg className="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

interface CardDetailProps {
  cardId: string | null;
  open: boolean;
  onClose: () => void;
}

/** The card detail bottom sheet — break-even meter, dates, and CRUD for benefits, MSRs, earn rates, and caps. */
export function CardDetail({ cardId, open, onClose }: CardDetailProps) {
  const { store, dispatch } = useStore();
  const state = store.data;

  const [expandedBenefitId, setExpandedBenefitId] = useState<string | null>(null);
  const [expandedMsrId, setExpandedMsrId] = useState<string | null>(null);
  const [expandedEarnRateId, setExpandedEarnRateId] = useState<string | null>(null);
  const [expandedCapId, setExpandedCapId] = useState<string | null>(null);
  const [addingMsr, setAddingMsr] = useState(false);

  const card = cardId ? (state.cards.find((c) => c.id === cardId) ?? null) : null;

  if (!card) {
    return (
      <Sheet open={open} onClose={onClose} ariaLabel="Card detail">
        {null}
      </Sheet>
    );
  }

  const benefits = state.benefits.filter((b) => b.cardId === card.id);
  const msrs = state.msrs.filter((m) => m.cardId === card.id);
  const earnRates = state.earnRates.filter((e) => e.cardId === card.id);
  const caps = state.caps.filter((c) => c.cardId === card.id);
  const be = cardBreakevenFor(state, card.id);
  const catalogCard = card.slug ? (CATALOG.cards.find((c) => c.slug === card.slug) ?? null) : null;
  const toBreakEven = Math.max(0, (card.fee ?? 0) - be.recovered);
  const opened = parseLocalDate(card.opened);

  function patchCard(patch: Partial<Omit<Card, 'id'>>) {
    dispatch({ type: 'UPDATE_CARD', id: card!.id, patch });
  }

  function addBenefit() {
    const id = crypto.randomUUID();
    const benefit: Benefit = {
      id,
      cardId: card!.id,
      name: 'New benefit',
      value: 0,
      displayValue: null,
      valueOverrides: null,
      cadence: 'monthly',
      anchor: 'calendar',
      category: 'other',
      notes: null,
    };
    dispatch({ type: 'ADD_BENEFIT', benefit });
    setExpandedBenefitId(id);
  }

  function addEarnRate() {
    const id = crypto.randomUUID();
    const earnRate: EarnRate = { id, cardId: card!.id, category: 'other', rate: 1, notes: null };
    dispatch({ type: 'ADD_EARN_RATE', earnRate });
    setExpandedEarnRateId(id);
  }

  function addCap() {
    const id = crypto.randomUUID();
    const now = new Date();
    const periodKey = periodFor({ value: null, displayValue: null, cadence: 'monthly', anchor: 'calendar' }, null, now).key;
    const cap: Cap = { id, cardId: card!.id, name: 'New cap', cadence: 'monthly', limit: 0, used: 0, periodKey };
    dispatch({ type: 'ADD_CAP', cap });
    setExpandedCapId(id);
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={card.name}>
      <div className="sheet-top">
        <div>
          <h2>{card.name}</h2>
          <div className="s">
            {card.issuer}
            {opened ? ` · opened ${monthYear(opened)}` : ''}
          </div>
        </div>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="meter-wrap">
        <div className="mrow">
          <b className="money">{usd(be.recovered)} recovered</b>
          <span className="money">{toBreakEven > 0 ? `${usd(toBreakEven)} to break even` : 'Break-even reached'}</span>
        </div>
        <ProgressBar value={be.recoveryPct} variant={barVariant(be.recoveryPct)} tick tall />
        <div className="meter-foot">
          <span className="money">{pct(be.recoveryPct)} of fee</span>
          <span className="money">{usd(card.fee ?? 0)} fee</span>
        </div>
      </div>

      <div className="sh-lbl">Benefits</div>
      <div className="bl-list">
        {benefits.length === 0 && <div className="cd-empty">No benefits yet.</div>}
        {benefits.map((b) => (
          <BenefitRow
            key={b.id}
            benefit={b}
            cardAnniversary={card.anniversary}
            state={state}
            dispatch={dispatch}
            expanded={expandedBenefitId === b.id}
            onToggleExpand={() => setExpandedBenefitId((id) => (id === b.id ? null : b.id))}
          />
        ))}
      </div>
      <div className="chips">
        <button type="button" className="chip sky" onClick={() => setAddingMsr((v) => !v)}>
          + Add MSR
        </button>
        <button type="button" className="chip ghost" onClick={addBenefit}>
          + Add benefit
        </button>
      </div>

      {addingMsr && (
        <AddMsrForm catalogCard={catalogCard} cardId={card.id} dispatch={dispatch} onDone={() => setAddingMsr(false)} />
      )}

      {msrs.length > 0 && (
        <>
          <div className="sh-lbl">Minimum spend</div>
          <div className="bl-list">
            {msrs.map((m) => (
              <MsrRow
                key={m.id}
                msr={m}
                dispatch={dispatch}
                expanded={expandedMsrId === m.id}
                onToggleExpand={() => setExpandedMsrId((id) => (id === m.id ? null : m.id))}
              />
            ))}
          </div>
        </>
      )}

      <div className="sh-lbl">Earn rates</div>
      <div className="bl-list">
        {earnRates.length === 0 && <div className="cd-empty">No earn rates yet.</div>}
        {earnRates.map((e) => (
          <EarnRateRow
            key={e.id}
            earnRate={e}
            dispatch={dispatch}
            expanded={expandedEarnRateId === e.id}
            onToggleExpand={() => setExpandedEarnRateId((id) => (id === e.id ? null : e.id))}
          />
        ))}
      </div>
      <div className="chips">
        <button type="button" className="chip ghost" onClick={addEarnRate}>
          + Add earn rate
        </button>
      </div>

      <div className="sh-lbl">Caps</div>
      <div className="bl-list">
        {caps.length === 0 && <div className="cd-empty">None — the catalog carries no cap data.</div>}
        {caps.map((c) => (
          <CapRow
            key={c.id}
            cap={c}
            dispatch={dispatch}
            expanded={expandedCapId === c.id}
            onToggleExpand={() => setExpandedCapId((id) => (id === c.id ? null : c.id))}
          />
        ))}
      </div>
      <div className="chips">
        <button type="button" className="chip ghost" onClick={addCap}>
          + Add cap
        </button>
      </div>

      <div className="sh-lbl">Card details</div>
      <div className="mrows">
        <div className="mr-edit">
          <span>Name</span>
          <input value={card.name} onChange={(e) => patchCard({ name: e.target.value })} />
        </div>
        <div className="mr-edit">
          <span>Issuer</span>
          <input value={card.issuer} onChange={(e) => patchCard({ issuer: e.target.value })} />
        </div>
        <div className="mr-edit">
          <span>Annual fee</span>
          <input
            type="number"
            inputMode="decimal"
            className="money"
            value={card.fee ?? ''}
            placeholder="—"
            onChange={(e) => patchCard({ fee: numberInputToValue(e.target.value) })}
          />
        </div>
        <div className="mr-edit">
          <span>Anniversary</span>
          <input type="date" value={card.anniversary ?? ''} onChange={(e) => patchCard({ anniversary: e.target.value || null })} />
        </div>
        <div className="mr-edit">
          <span>Opened</span>
          <input type="date" value={card.opened ?? ''} onChange={(e) => patchCard({ opened: e.target.value || null })} />
        </div>
        <div className="mr-edit">
          <span>Closed</span>
          <input type="date" value={card.closed ?? ''} onChange={(e) => patchCard({ closed: e.target.value || null })} />
        </div>
      </div>

      <button
        type="button"
        className="cd-remove"
        onClick={() => {
          dispatch({ type: 'DELETE_CARD', id: card.id });
          onClose();
        }}
      >
        Remove card
      </button>
    </Sheet>
  );
}

interface BenefitRowProps {
  benefit: Benefit;
  cardAnniversary: string | null;
  state: { redemptions: Record<string, number> };
  dispatch: Dispatch<StoreAction>;
  expanded: boolean;
  onToggleExpand: () => void;
}

function BenefitRow({ benefit, cardAnniversary, state, dispatch, expanded, onToggleExpand }: BenefitRowProps) {
  const now = new Date();
  const period = periodFor(benefit, { anniversary: cardAnniversary }, now);
  const value = resolveBenefitValue(benefit, period);
  const redeemed = Object.prototype.hasOwnProperty.call(state.redemptions, ledgerKey(benefit.id, period.key));
  const cadenceLabel = `${capitalize(benefit.cadence)} · ${benefit.anchor}`;
  const displayValue = value !== null ? usd(value) : (benefit.displayValue ?? '—');

  return (
    <div className="bl-wrap">
      <button type="button" className="bl" onClick={onToggleExpand}>
        <span className={`bd${redeemed ? ' on' : ''}`} />
        <div className="bl-main">
          <div className="bn">{benefit.name}</div>
          <div className="bc">{cadenceLabel}</div>
        </div>
        <div className="bv money">{displayValue}</div>
        <ChevronIcon />
      </button>
      {expanded && (
        <div className="editor">
          <label className="editor-field">
            <span>Name</span>
            <input value={benefit.name} onChange={(e) => dispatch({ type: 'UPDATE_BENEFIT', id: benefit.id, patch: { name: e.target.value } })} />
          </label>
          <div className="editor-row2">
            <label className="editor-field">
              <span>Value ($)</span>
              <input
                type="number"
                inputMode="decimal"
                value={benefit.value ?? ''}
                placeholder="—"
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_BENEFIT', id: benefit.id, patch: { value: numberInputToValue(e.target.value) } })
                }
              />
            </label>
            <label className="editor-field">
              <span>Display text</span>
              <input
                value={benefit.displayValue ?? ''}
                placeholder="e.g. Up to 85k pts"
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_BENEFIT',
                    id: benefit.id,
                    patch: { displayValue: e.target.value === '' ? null : e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="editor-row2">
            <label className="editor-field">
              <span>Cadence</span>
              <select
                value={benefit.cadence}
                onChange={(e) => dispatch({ type: 'UPDATE_BENEFIT', id: benefit.id, patch: { cadence: e.target.value as Cadence } })}
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {capitalize(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-field">
              <span>Anchor</span>
              <select
                value={benefit.anchor}
                onChange={(e) => dispatch({ type: 'UPDATE_BENEFIT', id: benefit.id, patch: { anchor: e.target.value as Anchor } })}
              >
                {ANCHORS.map((a) => (
                  <option key={a} value={a}>
                    {capitalize(a)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="editor-field">
            <span>Category</span>
            <select
              value={benefit.category}
              onChange={(e) => dispatch({ type: 'UPDATE_BENEFIT', id: benefit.id, patch: { category: e.target.value } })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {suffixesForCadence(benefit.cadence).length > 0 && (
            <div className="editor-overrides">
              <span className="editor-overrides-lbl">Per-period overrides</span>
              <div className="editor-overrides-grid">
                {suffixesForCadence(benefit.cadence).map((suffix) => (
                  <label key={suffix} className="override-field">
                    <span>{suffix}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={benefit.value != null ? String(benefit.value) : '—'}
                      value={benefit.valueOverrides?.[suffix] ?? ''}
                      onChange={(e) => {
                        const next = { ...(benefit.valueOverrides ?? {}) };
                        const v = numberInputToValue(e.target.value);
                        if (v === null) delete next[suffix];
                        else next[suffix] = v;
                        dispatch({
                          type: 'UPDATE_BENEFIT',
                          id: benefit.id,
                          patch: { valueOverrides: Object.keys(next).length > 0 ? next : null },
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="editor-delete" onClick={() => dispatch({ type: 'DELETE_BENEFIT', id: benefit.id })}>
            Delete benefit
          </button>
        </div>
      )}
    </div>
  );
}

interface MsrRowProps {
  msr: Msr;
  dispatch: Dispatch<StoreAction>;
  expanded: boolean;
  onToggleExpand: () => void;
}

function MsrRow({ msr, dispatch, expanded, onToggleExpand }: MsrRowProps) {
  const deadline = parseLocalDate(msr.deadline);
  function patch(p: Partial<Msr>) {
    dispatch({ type: 'UPDATE_MSR', id: msr.id, patch: p });
  }
  return (
    <div className="bl-wrap">
      <button type="button" className="bl" onClick={onToggleExpand}>
        <span className={`bd${msr.spent >= msr.requirement ? ' on' : ''}`} />
        <div className="bl-main">
          <div className="bn">{msr.label}</div>
          <div className="bc">
            {usd(msr.spent)} of {usd(msr.requirement)}
            {deadline ? ` · due ${shortDate(deadline)}` : ''}
          </div>
        </div>
        <ChevronIcon />
      </button>
      {expanded && (
        <div className="editor">
          <label className="editor-field">
            <span>Label</span>
            <input value={msr.label} onChange={(e) => patch({ label: e.target.value })} />
          </label>
          <div className="editor-row2">
            <label className="editor-field">
              <span>Requirement ($)</span>
              <input type="number" inputMode="decimal" value={msr.requirement} onChange={(e) => patch({ requirement: numberInputToValue(e.target.value) ?? 0 })} />
            </label>
            <label className="editor-field">
              <span>Spent ($)</span>
              <input type="number" inputMode="decimal" value={msr.spent} onChange={(e) => patch({ spent: numberInputToValue(e.target.value) ?? 0 })} />
            </label>
          </div>
          <div className="editor-row2">
            <label className="editor-field">
              <span>Deadline</span>
              <input type="date" value={msr.deadline} onChange={(e) => patch({ deadline: e.target.value })} />
            </label>
            <label className="editor-field">
              <span>Bonus value ($)</span>
              <input
                type="number"
                inputMode="decimal"
                value={msr.bonusValue ?? ''}
                placeholder="optional"
                onChange={(e) => patch({ bonusValue: numberInputToValue(e.target.value) })}
              />
            </label>
          </div>
          <button type="button" className="editor-delete" onClick={() => dispatch({ type: 'DELETE_MSR', id: msr.id })}>
            Delete MSR
          </button>
        </div>
      )}
    </div>
  );
}

interface EarnRateRowProps {
  earnRate: EarnRate;
  dispatch: Dispatch<StoreAction>;
  expanded: boolean;
  onToggleExpand: () => void;
}

function EarnRateRow({ earnRate, dispatch, expanded, onToggleExpand }: EarnRateRowProps) {
  function patch(p: Partial<EarnRate>) {
    dispatch({ type: 'UPDATE_EARN_RATE', id: earnRate.id, patch: p });
  }
  return (
    <div className="bl-wrap">
      <button type="button" className="bl" onClick={onToggleExpand}>
        <span className="bd" />
        <div className="bl-main">
          <div className="bn">{categoryName(earnRate.category)}</div>
          {earnRate.notes && <div className="bc">{earnRate.notes}</div>}
        </div>
        <div className="bv money">{earnRate.rate}×</div>
        <ChevronIcon />
      </button>
      {expanded && (
        <div className="editor">
          <label className="editor-field">
            <span>Category</span>
            <select value={earnRate.category} onChange={(e) => patch({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="editor-field">
            <span>Rate (×)</span>
            <input type="number" inputMode="decimal" value={earnRate.rate} onChange={(e) => patch({ rate: numberInputToValue(e.target.value) ?? 0 })} />
          </label>
          <label className="editor-field">
            <span>Notes</span>
            <input value={earnRate.notes ?? ''} onChange={(e) => patch({ notes: e.target.value === '' ? null : e.target.value })} />
          </label>
          <button type="button" className="editor-delete" onClick={() => dispatch({ type: 'DELETE_EARN_RATE', id: earnRate.id })}>
            Delete earn rate
          </button>
        </div>
      )}
    </div>
  );
}

interface CapRowProps {
  cap: Cap;
  dispatch: Dispatch<StoreAction>;
  expanded: boolean;
  onToggleExpand: () => void;
}

function CapRow({ cap, dispatch, expanded, onToggleExpand }: CapRowProps) {
  function patch(p: Partial<Cap>) {
    dispatch({ type: 'UPDATE_CAP', id: cap.id, patch: p });
  }
  return (
    <div className="bl-wrap">
      <button type="button" className="bl" onClick={onToggleExpand}>
        <span className={`bd${cap.used >= cap.limit && cap.limit > 0 ? ' on' : ''}`} />
        <div className="bl-main">
          <div className="bn">{cap.name}</div>
          <div className="bc">
            {usd(cap.used)} of {usd(cap.limit)} · {cap.cadence}
          </div>
        </div>
        <ChevronIcon />
      </button>
      {expanded && (
        <div className="editor">
          <label className="editor-field">
            <span>Name</span>
            <input value={cap.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <div className="editor-row2">
            <label className="editor-field">
              <span>Limit ($)</span>
              <input type="number" inputMode="decimal" value={cap.limit} onChange={(e) => patch({ limit: numberInputToValue(e.target.value) ?? 0 })} />
            </label>
            <label className="editor-field">
              <span>Used ($)</span>
              <input type="number" inputMode="decimal" value={cap.used} onChange={(e) => patch({ used: numberInputToValue(e.target.value) ?? 0 })} />
            </label>
          </div>
          <label className="editor-field">
            <span>Cadence</span>
            <select value={cap.cadence} onChange={(e) => patch({ cadence: e.target.value as Cadence })}>
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {capitalize(c)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="editor-delete" onClick={() => dispatch({ type: 'DELETE_CAP', id: cap.id })}>
            Delete cap
          </button>
        </div>
      )}
    </div>
  );
}

interface AddMsrFormProps {
  catalogCard: CatalogCard | null;
  cardId: string;
  dispatch: Dispatch<StoreAction>;
  onDone: () => void;
}

function AddMsrForm({ catalogCard, cardId, dispatch, onDone }: AddMsrFormProps) {
  const [label, setLabel] = useState('');
  const [requirement, setRequirement] = useState('');
  const [deadline, setDeadline] = useState('');
  const [bonusValue, setBonusValue] = useState('');
  const [touched, setTouched] = useState(false);

  const requirementNum = numberInputToValue(requirement);
  const valid = label.trim() !== '' && requirementNum !== null && requirementNum > 0 && deadline !== '';

  function save() {
    setTouched(true);
    if (!valid || requirementNum === null) return;
    dispatch({
      type: 'ADD_MSR',
      msr: {
        id: crypto.randomUUID(),
        cardId,
        label: label.trim(),
        requirement: requirementNum,
        deadline,
        spent: 0,
        bonusValue: numberInputToValue(bonusValue),
        notes: null,
      },
    });
    onDone();
  }

  return (
    <div className="editor msr-add">
      {catalogCard && catalogCard.spendThresholds.length > 0 && (
        <div className="msr-suggestions">
          {catalogCard.spendThresholds.map((t) => (
            <button
              key={t.label}
              type="button"
              className="chip ghost"
              onClick={() => {
                setLabel(t.label);
                setRequirement(String(t.requirement));
              }}
            >
              {t.label} · {usd(t.requirement)}
            </button>
          ))}
        </div>
      )}
      <label className="editor-field">
        <span>Label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sign-up bonus" />
      </label>
      <div className="editor-row2">
        <label className="editor-field">
          <span>Requirement ($)</span>
          <input type="number" inputMode="decimal" value={requirement} onChange={(e) => setRequirement(e.target.value)} />
        </label>
        <label className="editor-field">
          <span>Bonus value ($)</span>
          <input type="number" inputMode="decimal" value={bonusValue} onChange={(e) => setBonusValue(e.target.value)} placeholder="optional" />
        </label>
      </div>
      <label className="editor-field">
        <span>Deadline{touched && deadline === '' ? ' — required' : ''}</span>
        <input
          type="date"
          className={touched && deadline === '' ? 'invalid' : ''}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </label>
      <div className="editor-actions">
        <button type="button" className="chip ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="chip sky" disabled={touched && !valid} onClick={save}>
          Save MSR
        </button>
      </div>
    </div>
  );
}
