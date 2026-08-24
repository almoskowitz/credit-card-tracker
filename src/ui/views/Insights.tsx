import { useStore } from '../../state/store';
import { cardsForProfile, portfolioBreakevenForProfile } from '../../state/selectors';
import { bestCardForCategory, optimalWalletScored, type OptimizerCard } from '../../engine/optimizer';
import { CATEGORIES } from '../../catalog/categories';
import type { Card, State } from '../../state/schema';
import { usd, pct, centsPerDollar, numberInputToValue, initials } from '../format';
import '../../App.css';
import '../shared.css';
import './Insights.css';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** A card with no rewardCurrency set (or one that no longer matches a known currency) is
 * treated as cash/1.0 -- this must not change ranking for any card that predates this feature. */
function centsPerPointFor(state: State, card: Card): number {
  if (!card.rewardCurrency) return 1.0;
  const currency = state.rewardCurrencies.find((rc) => rc.id === card.rewardCurrency);
  return currency ? currency.centsPerPoint : 1.0;
}

function DonutIcon({ value }: { value: number }) {
  const r = 19;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r={r} fill="none" stroke="var(--glass-1)" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke="var(--mint)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 23 23)"
      />
    </svg>
  );
}

interface InsightsProps {
  profileId: string;
  onProfileTap: () => void;
}

export function Insights({ profileId, onProfileTap }: InsightsProps) {
  const { store, dispatch } = useStore();
  const state = store.data;
  const now = new Date();

  const cards = cardsForProfile(state, profileId, now);
  const profile = state.profiles.find((p) => p.id === profileId);
  const portfolio = portfolioBreakevenForProfile(state, profileId, now);
  const cardName = (id: string) => cards.find((c) => c.id === id)?.name ?? 'Unknown card';

  const optimizerCards: OptimizerCard[] = cards.map((c) => ({
    id: c.id,
    earnRates: state.earnRates.filter((e) => e.cardId === c.id).map((e) => ({ category: e.category, rate: e.rate })),
    centsPerPoint: centsPerPointFor(state, c),
  }));

  const monthKeyStr = monthKey(now);
  const monthSpend = state.spend[monthKeyStr] ?? {};
  const hasSpend = Object.keys(state.spend).length > 0;

  return (
    <div>
      <div className="hdr">
        <div>
          <h1>Insights</h1>
          <div className="h-sub">
            Fee year to date · {cards.length} card{cards.length === 1 ? '' : 's'}
          </div>
        </div>
        <button type="button" className="chip-profile" onClick={onProfileTap} aria-label="Switch profile">
          {initials(profile?.name ?? '?')}
        </button>
      </div>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat donut" style={{ flex: 1.25 }}>
          <DonutIcon value={portfolio.recoveryPct} />
          <div>
            <div className="k">Recovery</div>
            <div className="v money">{pct(portfolio.recoveryPct)}</div>
          </div>
        </div>
        <div className="stat">
          <div className="k">Net cost</div>
          <div className="v money">{usd(portfolio.netCost)}</div>
        </div>
      </div>
      <div className="stats" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="k">Recovered</div>
          <div className="v money">{usd(portfolio.recovered)}</div>
        </div>
        <div className="stat">
          <div className="k">Fees paid</div>
          <div className="v money">{usd(portfolio.totalFees)}</div>
        </div>
      </div>

      <div className="sh-lbl">Best card per category</div>
      <div className="grid2">
        {CATEGORIES.map((cat) => {
          const best = cards.length > 0 ? bestCardForCategory(optimizerCards, cat.slug) : null;
          return (
            <div key={cat.slug} className="gtile">
              <div className="c">{cat.name}</div>
              {best ? (
                <>
                  <div className="n">{cardName(best.card.id)}</div>
                  <div className="m">
                    {best.rate}× <span className="m-value">{centsPerDollar(best.value)}</span>
                    {best.fallback && <span className="fallback-tag">fallback</span>}
                  </div>
                </>
              ) : (
                <div className="n dim">No card yet</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sh-lbl">Wallet recommendations</div>
      {!hasSpend && (
        <div className="insights-note">Unweighted — ranked by total earn rate. Enter this month&rsquo;s spend below to weight by category.</div>
      )}
      {cards.length === 0 ? (
        <div className="cd-empty">Add cards to your wallet to see recommendations here.</div>
      ) : (
        [3, 5, 7].map((size) => (
          <WalletSuggestion key={size} size={size} cards={optimizerCards} spend={state.spend} cardName={cardName} />
        ))
      )}

      <div className="sh-lbl">This month&rsquo;s spend</div>
      <div className="spend-grid">
        {CATEGORIES.map((cat) => (
          <label key={cat.slug} className="spend-field">
            <span>{cat.name}</span>
            <input
              type="number"
              inputMode="decimal"
              value={monthSpend[cat.slug] ?? ''}
              placeholder="0"
              onChange={(e) => {
                const amount = numberInputToValue(e.target.value) ?? 0;
                dispatch({ type: 'SET_SPEND', month: monthKeyStr, categoryId: cat.slug, amount });
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function WalletSuggestion({
  size,
  cards,
  spend,
  cardName,
}: {
  size: number;
  cards: OptimizerCard[];
  spend: Record<string, Record<string, number>>;
  cardName: (id: string) => string;
}) {
  const scored = optimalWalletScored(cards, spend, size);
  const hasSpend = Object.keys(spend).length > 0;
  return (
    <div className="suggest">
      <h3>{size}-card wallet</h3>
      {scored.map((s) => (
        <div key={s.card.id} className="sl">
          <b>{cardName(s.card.id)}</b>
          {/* With spend data, `score` is cents of estimated value earned (rate x
              centsPerPoint x amount) -- genuinely dollar-denominated once normalized, so it's
              shown as a value rather than an opaque score. Without spend data it's an
              unweighted, unitless sum of normalized rates -- still just for ranking. */}
          <em>{hasSpend ? `~${usd(s.score / 100)} est. value` : `score ${Math.round(s.score).toLocaleString('en-US')}`}</em>
        </div>
      ))}
    </div>
  );
}
