import { useEffect, useRef, useState } from 'react';
import './ProgressBar.css';

export type ProgressVariant = 'risk' | 'ok' | 'mint' | 'amber' | 'red';

interface ProgressBarProps {
  /** 0-100. Values outside that range are clamped for the bar; callers still show the real number in text. */
  value: number;
  variant: ProgressVariant;
  /** Marks the 100% mark with a small tick, per the mockup's break-even meters. */
  tick?: boolean;
  tall?: boolean;
}

/** Animates in from 0 on mount, per the mockup's paintBars() — then tracks value changes directly. */
export function ProgressBar({ value, variant, tick, tall }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const [painted, setPainted] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    raf.current = requestAnimationFrame(() => setPainted(clamped));
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  return (
    <div className={`progress-track${tall ? ' tall' : ''}`}>
      <span className={`progress-fill variant-${variant}`} style={{ width: `${painted}%` }} />
      {tick && <span className="progress-tick" />}
    </div>
  );
}
