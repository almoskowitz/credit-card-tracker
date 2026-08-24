export type Cadence = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type Anchor = 'calendar' | 'anniversary';

export interface Benefit {
  value: number | null;
  displayValue: string | null;
  cadence: Cadence;
  anchor: Anchor;
  valueOverrides?: Record<string, number> | null;
}

export interface Card {
  anniversary?: string | null;
}

export interface Period {
  start: Date;
  end: Date;
  key: string;
}

const MONTHS: Record<Cadence, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

export function clampDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

export function daysLeft(now: Date, end: Date): number {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / 86_400_000);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function calendarPeriod(cadence: Cadence, now: Date): Period {
  const span = MONTHS[cadence];
  const bucket = Math.floor(now.getMonth() / span) * span;
  const start = new Date(now.getFullYear(), bucket, 1);
  const end = new Date(now.getFullYear(), bucket + span, 1);
  const key = `${now.getFullYear()}-${pad2(bucket + 1)}`;
  return { start, end, key };
}

function anniversaryPeriod(cadence: Cadence, a: Date, now: Date): Period {
  const span = MONTHS[cadence];
  const anniDay = a.getDate();

  let months = (now.getFullYear() - a.getFullYear()) * 12 + (now.getMonth() - a.getMonth());

  // Compare against the anniversary day clamped INTO THE CURRENT MONTH, not the raw day —
  // a Jan-31 anniversary in February must roll over on Feb 28, not wait for a Feb 31 that
  // never arrives.
  const lastOfNow = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const effective = Math.min(anniDay, lastOfNow);
  if (now.getDate() < effective) months--;

  const idx = Math.floor(months / span) * span;
  // clampDay always receives the original anniDay, never a previously clamped one, so a
  // Jan-31 anniversary does not degrade to the 28th permanently after passing through Feb.
  const start = clampDay(a.getFullYear(), a.getMonth() + idx, anniDay);
  const end = clampDay(a.getFullYear(), a.getMonth() + idx + span, anniDay);
  const key = 'A' + isoDate(start);
  return { start, end, key };
}

export function periodFor(benefit: Benefit, card: Card | null | undefined, now: Date = new Date()): Period {
  if (benefit.anchor === 'anniversary') {
    const a = parseLocalDate(card?.anniversary);
    if (a) return anniversaryPeriod(benefit.cadence, a, now);
  }
  return calendarPeriod(benefit.cadence, now);
}

function periodSuffix(cadence: Cadence, start: Date): string | null {
  if (cadence === 'monthly') return `M${start.getMonth() + 1}`;
  if (cadence === 'quarterly') return `Q${Math.floor(start.getMonth() / 3) + 1}`;
  if (cadence === 'semiannual') return `H${Math.floor(start.getMonth() / 6) + 1}`;
  return null;
}

export function resolveBenefitValue(benefit: Benefit, period: Period): number | null {
  const suffix = periodSuffix(benefit.cadence, period.start);
  if (suffix && benefit.valueOverrides && suffix in benefit.valueOverrides) {
    return benefit.valueOverrides[suffix];
  }
  return benefit.value;
}

export function ledgerKey(benefitId: string, periodKey: string): string {
  return `${benefitId}|${periodKey}`;
}

const PAST_PERIOD_WINDOW: Record<Cadence, number> = { monthly: 12, quarterly: 8, semiannual: 4, annual: 3 };

export function defaultPastPeriodCount(cadence: Cadence): number {
  return PAST_PERIOD_WINDOW[cadence];
}

/**
 * The `count` periods strictly before the one `now` falls in, most recent first — walking
 * backward one period at a time via `periodFor` so cadence and anchor (including anniversary
 * rollover) are respected exactly as they are for the live period. No floor at `card.opened`:
 * logging usage from before a card was added to the app is intentional, not a bug.
 */
export function pastPeriods(
  benefit: Benefit,
  card: Card | null | undefined,
  now: Date = new Date(),
  count: number = defaultPastPeriodCount(benefit.cadence),
): Period[] {
  const periods: Period[] = [];
  let boundary = periodFor(benefit, card, now).start;
  for (let i = 0; i < count; i++) {
    const p = periodFor(benefit, card, new Date(boundary.getTime() - 1));
    periods.push(p);
    boundary = p.start;
  }
  return periods;
}
