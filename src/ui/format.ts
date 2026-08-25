import type { BonusComponent } from '../state/schema';

export function usd(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.001;
  return rounded.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

export function monthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Jan 1 – Dec 31 2025", or "Jan 31 2026 – Jan 30 2027" when the span crosses a year. */
export function dateRange(start: Date, end: Date): string {
  if (start.getFullYear() === end.getFullYear()) {
    return `${shortDate(start)} – ${shortDate(end)} ${end.getFullYear()}`;
  }
  return `${shortDate(start)} ${start.getFullYear()} – ${shortDate(end)} ${end.getFullYear()}`;
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** One decimal place, trimmed to a whole number when exact — 57.6%, 62.5%, 100%. */
export function pct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** Estimated cents-of-value-per-dollar, one decimal place — "8.0¢/$". */
export function centsPerDollar(n: number): string {
  return `~${n.toFixed(1)}¢/$`;
}

/** Empty string becomes null; otherwise passed through unchanged ("YYYY-MM-DD" from a date input). */
export function dateInputToValue(s: string): string | null {
  return s === '' ? null : s;
}

/** Empty string becomes null; a valid number is returned, otherwise null. */
export function numberInputToValue(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Money-formats a "cash" unit; renders anything else as a plain thousands-separated number
 * plus the free-text unit ("80,000 points", "1 cert"). Falls back to the label when there's
 * no numeric value to show (a purely descriptive component like a companion pass).
 */
export function formatBonusComponent(component: BonusComponent): string {
  const { value, unit, label } = component;
  if (value == null) return label;
  return unit === 'cash' ? usd(value) : `${Math.round(value).toLocaleString('en-US')} ${unit}`;
}

/** Joins 0, 1, or many bonus components into a single summary fragment ("" when empty). */
export function formatBonus(bonuses: BonusComponent[]): string {
  return bonuses.map(formatBonusComponent).join(' + ');
}
