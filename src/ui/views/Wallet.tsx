import { useState, type CSSProperties } from 'react';
import { useStore } from '../../state/store';
import { cardsForProfile, cardBreakevenFor } from '../../state/selectors';
import { parseLocalDate } from '../../engine/period';
import { ProgressBar, type ProgressVariant } from '../components/ProgressBar';
import { usd, pct, shortDate } from '../format';
import { issuerVar } from '../issuer';
import { CardDetail } from './CardDetail';
import { CatalogSheet } from './CatalogSheet';
import '../../App.css';
import './Wallet.css';

function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as unknown as CSSProperties;
}

function barVariant(recoveryPct: number): ProgressVariant {
  if (recoveryPct >= 85) return 'mint';
  if (recoveryPct >= 50) return 'amber';
  return 'red';
}

interface WalletProps {
  profileId: string;
}

export function Wallet({ profileId }: WalletProps) {
  const { store } = useStore();
  const state = store.data;
  const now = new Date();

  const cards = cardsForProfile(state, profileId, now);
  const totalFees = cards.reduce((sum, c) => sum + (c.fee ?? 0), 0);

  const [sheetCardId, setSheetCardId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  function openCard(id: string) {
    setSheetCardId(id);
    setSheetOpen(true);
  }

  return (
    <div>
      <div className="hdr">
        <div>
          <h1>Wallet</h1>
          <div className="h-sub money">
            {cards.length} card{cards.length === 1 ? '' : 's'} · {usd(totalFees)} in annual fees
          </div>
        </div>
        <button type="button" className="btn-round" aria-label="Add card" onClick={() => setCatalogOpen(true)}>
          +
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="wallet-empty">No cards yet. Tap + to add one from the catalog, paste JSON, or start blank.</div>
      ) : (
        <>
          <div className="rows wallet-rows">
            {cards.map((card) => {
              const be = cardBreakevenFor(state, card.id, now);
              const fee = card.fee ?? 0;
              const showBar = fee > 0;
              const variant = barVariant(be.recoveryPct);
              const anniversary = parseLocalDate(card.anniversary);
              return (
                <button key={card.id} type="button" className="wcard" onClick={() => openCard(card.id)}>
                  <span className="edge" style={cssVar('--acc', issuerVar(card.issuer))} />
                  <div className="wmain">
                    <div className="wname">{card.name}</div>
                    <div className="wsub money">
                      {fee > 0 ? `${usd(fee)}/yr` : 'No annual fee'}
                      {anniversary ? ` · anniversary ${shortDate(anniversary)}` : ''}
                    </div>
                    {showBar && (
                      <div className="wallet-bar">
                        <ProgressBar value={be.recoveryPct} variant={variant} tick />
                      </div>
                    )}
                  </div>
                  {showBar ? (
                    <div className={`wpct money c-${variant}`}>{pct(be.recoveryPct)}</div>
                  ) : (
                    <div className="wpct money c-mint">{usd(be.recovered)}</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="wallet-hint">Tap a card for benefits, MSRs and fee dates</div>
        </>
      )}

      <CardDetail cardId={sheetCardId} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <CatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} profileId={profileId} />
    </div>
  );
}
