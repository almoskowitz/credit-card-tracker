import { useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../../state/store';
import { groupRunway, msrsForProfile, runwayItems, type MsrWithStatus, type RunwayItem } from '../../state/selectors';
import { GlassCardButton } from '../components/GlassCard';
import { ProgressBar } from '../components/ProgressBar';
import { TapToggle } from '../components/TapToggle';
import { NumericPad } from '../components/NumericPad';
import { useToast } from '../components/Toast';
import { usd, monthYear, daysInMonth, shortDate, initials } from '../format';
import { issuerVar } from '../issuer';
import '../../App.css';
import './Today.css';

interface TodayProps {
  profileId: string;
  onProfileTap: () => void;
}

function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as unknown as CSSProperties;
}

function MsrCard({ msr, cardName, onTap }: { msr: MsrWithStatus; cardName: string; onTap: () => void }) {
  const pct = msr.requirement > 0 ? Math.min(100, (msr.spent / msr.requirement) * 100) : 100;
  const risk = msr.atRisk || msr.missed;
  const tagLabel = msr.missed ? 'Missed' : msr.atRisk ? 'At risk' : 'On track';

  return (
    <GlassCardButton className="msr" risk={risk} onClick={onTap}>
      <div className="msr-top">
        <div>
          <div className="msr-card">{cardName}</div>
          <div className="msr-bonus">{msr.label}</div>
        </div>
        <div className={`msr-tag ${risk ? 'r' : 'g'}`}>{tagLabel}</div>
      </div>
      <div className="msr-amt money">
        <b>{usd(msr.spent)}</b>
        <em>of {usd(msr.requirement)}</em>
      </div>
      <ProgressBar value={pct} variant={risk ? 'risk' : 'ok'} />
      <div className="msr-meta money">
        {msr.missed ? (
          <span className="hot">{usd(msr.remaining)} still needed · deadline passed</span>
        ) : (
          <>
            <b>{usd(msr.remaining)}</b> left · {msr.daysToDeadline}d ·{' '}
            <span className={risk ? 'hot' : 'cool'}>{usd(msr.perWeek)}/wk needed</span>
          </>
        )}
      </div>
    </GlassCardButton>
  );
}

function Row({
  item,
  pending,
  onToggle,
}: {
  item: RunwayItem;
  pending: boolean;
  onToggle: () => void;
}) {
  const { benefit, card, value, daysLeft, redeemed } = item;
  const visuallyDone = redeemed || pending;
  const showPill = !redeemed && daysLeft <= 31;
  const hot = daysLeft <= 7;
  const displayValue = value !== null ? usd(value) : (benefit.displayValue ?? '—');

  return (
    <div className={`row${visuallyDone ? ' done' : ''}`}>
      <span className="edge" style={cssVar('--acc', issuerVar(card.issuer))} />
      <div className="rmain">
        <div className="rname">{benefit.name}</div>
        <div className="rsub">
          <span className="w money">
            {card.name} · ends {shortDate(item.period.end)}
          </span>
          {showPill && <span className={`pill${hot ? ' hot' : ''}`}>{Math.max(daysLeft, 0)}d</span>}
        </div>
      </div>
      <div className="rval money">{displayValue}</div>
      <TapToggle checked={visuallyDone} onToggle={onToggle} label="Mark used" disabled={pending && !redeemed} />
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

const RELOCATE_DELAY_MS = 420;

export function Today({ profileId, onProfileTap }: TodayProps) {
  const { store, dispatch } = useStore();
  const { showToast } = useToast();
  const state = store.data;
  const now = new Date();

  const items = runwayItems(state, profileId, now);
  const groups = groupRunway(items);
  const msrs = msrsForProfile(state, profileId, now);
  const cardName = (cardId: string) => state.cards.find((c) => c.id === cardId)?.name ?? 'Unknown card';

  const [pendingDone, setPendingDone] = useState<ReadonlySet<string>>(new Set());
  const [doneOpen, setDoneOpen] = useState(false);
  const [msrPad, setMsrPad] = useState<MsrWithStatus | null>(null);
  const [editPad, setEditPad] = useState<RunwayItem | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const connection = store.connection;
  const profile = state.profiles.find((p) => p.id === profileId);

  const totalLeft = [...groups.endingThisWeek, ...groups.endingThisMonth, ...groups.laterThisPeriod].reduce(
    (sum, item) => sum + (item.value ?? 0),
    0,
  );
  const doneTotal = groups.done.reduce((sum, item) => sum + (item.redeemedAmount ?? 0), 0);
  const hasAnything = msrs.length > 0 || items.length > 0;

  function clearTimer(id: string) {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }

  function commitRedeem(item: RunwayItem, amount: number) {
    dispatch({ type: 'SET_REDEMPTION', benefitId: item.benefit.id, periodKey: item.period.key, amount });
    setPendingDone((prev) => {
      if (!prev.has(item.benefit.id)) return prev;
      const next = new Set(prev);
      next.delete(item.benefit.id);
      return next;
    });
    setDoneOpen(true);
  }

  function handleToggle(item: RunwayItem) {
    if (connection === 'unreachable') return;
    const id = item.benefit.id;

    if (!item.redeemed) {
      const amount = item.value ?? 0;
      setPendingDone((prev) => new Set(prev).add(id));
      showToast(`Marked used · ${usd(amount)}`, {
        actionLabel: 'Edit amount',
        onAction: () => {
          clearTimer(id);
          setEditPad(item);
        },
      });
      const timer = setTimeout(() => commitRedeem(item, amount), RELOCATE_DELAY_MS);
      timers.current.set(id, timer);
    } else {
      dispatch({ type: 'DELETE_REDEMPTION', benefitId: item.benefit.id, periodKey: item.period.key });
      showToast(`Undone · ${usd(item.redeemedAmount ?? 0)} back on the runway`);
    }
  }

  return (
    <div>
      <div className="hdr">
        <div>
          <div className="h-month">{monthYear(now)}</div>
          <div className="h-sub money">
            Day {now.getDate()} of {daysInMonth(now)} · {usd(totalLeft)} on the runway
          </div>
        </div>
        <button type="button" className="chip-profile" onClick={onProfileTap} aria-label="Switch profile">
          {initials(profile?.name ?? '?')}
          <span className={`dot-live${connection === 'unreachable' ? ' unreachable' : ''}`} />
        </button>
      </div>

      {!hasAnything && (
        <div className="today-empty">No cards yet. Add one from Wallet to see your runway here.</div>
      )}

      {msrs.length > 0 && (
        <>
          <div className="msr-head">
            <div className="lbl">Minimum spend</div>
            <div className="note">Sorted by risk</div>
          </div>
          <div className="msr-strip">
            {msrs.map((msr) => (
              <MsrCard key={msr.id} msr={msr} cardName={cardName(msr.cardId)} onTap={() => setMsrPad(msr)} />
            ))}
          </div>
        </>
      )}

      <Section
        title="Ending this week"
        items={groups.endingThisWeek}
        pendingDone={pendingDone}
        onToggle={handleToggle}
      />
      <Section
        title="Ending this month"
        items={groups.endingThisMonth}
        pendingDone={pendingDone}
        onToggle={handleToggle}
      />
      <Section
        title="Later this period"
        items={groups.laterThisPeriod}
        pendingDone={pendingDone}
        onToggle={handleToggle}
      />

      {groups.done.length > 0 && (
        <>
          <button
            type="button"
            className={`done-head${doneOpen ? ' open' : ''}`}
            onClick={() => setDoneOpen((o) => !o)}
          >
            <ChevronIcon />
            <div className="lbl">Done</div>
            <div className="cnt">{groups.done.length}</div>
            <div className="tot money">{usd(doneTotal)} recovered</div>
          </button>
          <div className={`done-list${doneOpen ? ' open' : ''}`}>
            {groups.done.map((item) => (
              <Row key={item.benefit.id} item={item} pending={false} onToggle={() => handleToggle(item)} />
            ))}
          </div>
        </>
      )}

      <NumericPad
        open={msrPad !== null}
        onClose={() => setMsrPad(null)}
        title={msrPad ? cardName(msrPad.cardId) : ''}
        subtitle={msrPad?.label}
        confirmLabel="Log spend"
        onConfirm={(amount) => {
          if (msrPad) {
            dispatch({ type: 'UPDATE_MSR', id: msrPad.id, patch: { spent: msrPad.spent + amount } });
          }
          setMsrPad(null);
        }}
      />

      <NumericPad
        open={editPad !== null}
        onClose={() => setEditPad(null)}
        title="Edit amount"
        subtitle={editPad?.benefit.name}
        confirmLabel="Save"
        initialValue={editPad?.value ?? 0}
        onConfirm={(amount) => {
          if (editPad) commitRedeem(editPad, amount);
          setEditPad(null);
        }}
      />
    </div>
  );
}

function Section({
  title,
  items,
  pendingDone,
  onToggle,
}: {
  title: string;
  items: RunwayItem[];
  pendingDone: ReadonlySet<string>;
  onToggle: (item: RunwayItem) => void;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  return (
    <>
      <div className="sec-head">
        <div className="lbl">{title}</div>
        <div className="cnt">{items.length}</div>
        <div className="tot money">{usd(total)} left</div>
      </div>
      <div className="rows">
        {items.map((item) => (
          <Row
            key={item.benefit.id}
            item={item}
            pending={pendingDone.has(item.benefit.id)}
            onToggle={() => onToggle(item)}
          />
        ))}
      </div>
    </>
  );
}
