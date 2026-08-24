import type { BonusUnit } from '../state/schema';

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

/** Money-formats cash amounts; renders points/miles as a plain thousands-separated number with a unit suffix. */
export function formatBonus(value: number, unit: BonusUnit = 'cash'): string {
  if (unit === 'cash') return usd(value);
  const suffix = unit === 'points' ? 'pts' : 'mi';
  return `${Math.round(value).toLocaleString('en-US')} ${suffix}`;
}
