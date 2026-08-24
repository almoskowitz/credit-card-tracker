import { useState } from 'react';
import { Sheet } from './Sheet';
import './NumericPad.css';

interface NumericPadProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  /** Pre-fills the display, e.g. editing an already-logged amount. */
  initialValue?: number;
  onConfirm: (amount: number) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/** A bottom sheet with a large numeric pad — used for MSR spend logging and the redemption "Edit amount" flow. */
export function NumericPad({ open, onClose, title, subtitle, confirmLabel, initialValue, onConfirm }: NumericPadProps) {
  const [entry, setEntry] = useState(() => (initialValue != null ? String(initialValue) : ''));

  function reset() {
    setEntry(initialValue != null ? String(initialValue) : '');
  }

  function press(key: string) {
    if (key === 'back') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    if (key === '.' && entry.includes('.')) return;
    setEntry((e) => {
      const next = e + key;
      const [, decimals] = next.split('.');
      if (decimals && decimals.length > 2) return e;
      return next;
    });
  }

  const amount = Number(entry || 0);
  const valid = entry !== '' && !Number.isNaN(amount) && amount >= 0;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      ariaLabel={title}
    >
      <div className="numpad-top">
        <div className="numpad-title">{title}</div>
        {subtitle && <div className="numpad-sub">{subtitle}</div>}
      </div>
      <div className="numpad-display money">${entry || '0'}</div>
      <div className="numpad-grid">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`numpad-key${key === 'back' ? ' ghost' : ''}`}
            onClick={() => press(key)}
          >
            {key === 'back' ? '⌫' : key}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="numpad-confirm"
        disabled={!valid}
        onClick={() => {
          if (!valid) return;
          onConfirm(amount);
          reset();
        }}
      >
        {confirmLabel}
      </button>
    </Sheet>
  );
}
