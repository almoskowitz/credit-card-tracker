import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import './GlassCard.css';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  risk?: boolean;
}

/** The one raised, blurred glass surface in the app — MSR cards, sheets, stat tiles. */
export function GlassCard({ children, risk, className, ...rest }: GlassCardProps) {
  const cls = ['glass-card', risk ? 'risk' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

interface GlassCardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  risk?: boolean;
}

/** Same surface, but as a tappable button (MSR cards are tap-to-log-spend targets). */
export function GlassCardButton({ children, risk, className, ...rest }: GlassCardButtonProps) {
  const cls = ['glass-card', 'glass-card-btn', risk ? 'risk' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
