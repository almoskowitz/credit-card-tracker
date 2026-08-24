import { describe, it, expect } from 'vitest';
import {
  clampDay,
  daysLeft,
  periodFor,
  resolveBenefitValue,
  ledgerKey,
  type Benefit,
  type Card,
} from '../src/engine/period';

const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s);

const benefit = (cadence: Benefit['cadence'], anchor: Benefit['anchor']): Benefit => ({
  value: 10,
  displayValue: null,
  cadence,
  anchor,
  valueOverrides: null,
});

describe('periodFor — anniversary anchor', () => {
  it('PE-1 — Jan 31 fee date, quarterly cadence, first window', () => {
    const card: Card = { anniversary: '2026-01-31' };
    const b = benefit('quarterly', 'anniversary');
    const p = periodFor(b, card, local(2026, 2, 15, 12));
    expect(p.start).toEqual(local(2026, 1, 31));
    expect(p.end).toEqual(local(2026, 4, 30));
    expect(p.key).toBe('A2026-01-31');
  });

  it('PE-2 — Jan 31 fee date, quarterly cadence, all four windows', () => {
    const card: Card = { anniversary: '2026-01-31' };
    const b = benefit('quarterly', 'anniversary');

    const w1 = periodFor(b, card, local(2026, 2, 15));
    const w2 = periodFor(b, card, local(2026, 5, 15));
    const w3 = periodFor(b, card, local(2026, 8, 15));
    const w4 = periodFor(b, card, local(2026, 11, 15));

    expect(w1).toEqual({ start: local(2026, 1, 31), end: local(2026, 4, 30), key: 'A2026-01-31' });
    expect(w2).toEqual({ start: local(2026, 4, 30), end: local(2026, 7, 31), key: 'A2026-04-30' });
    expect(w3).toEqual({ start: local(2026, 7, 31), end: local(2026, 10, 31), key: 'A2026-07-31' });
    expect(w4).toEqual({ start: local(2026, 10, 31), end: local(2027, 1, 31), key: 'A2026-10-31' });

    // contiguous, no gap/overlap
    expect(w1.end).toEqual(w2.start);
    expect(w2.end).toEqual(w3.start);
    expect(w3.end).toEqual(w4.start);

    // fourth window's end returns to the 31st (clamp uses original anniDay, not degraded)
    expect(w4.end).toEqual(local(2027, 1, 31));
  });

  it('PE-3 — Feb 29 fee date evaluated in a non-leap year', () => {
    const card: Card = { anniversary: '2024-02-29' };
    const b = benefit('annual', 'anniversary');
    const p = periodFor(b, card, local(2027, 6, 1, 12));
    expect(p.start).toEqual(local(2027, 2, 28));
    expect(p.end).toEqual(local(2028, 2, 29));
    expect(p.key).toBe('A2027-02-28');
  });

  it('PE-11 — day-31 anniversary in a short month advances correctly', () => {
    const card: Card = { anniversary: '2026-01-31' };
    const b = benefit('monthly', 'anniversary');
    const now = local(2026, 2, 28, 12);
    const p = periodFor(b, card, now);
    expect(p.start).toEqual(local(2026, 2, 28));
    expect(p.end).toEqual(local(2026, 3, 31));
    expect(p.key).toBe('A2026-02-28');
    expect(p.start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(now.getTime()).toBeLessThan(p.end.getTime());
  });

  it('anniversary anchor with no anniversary set falls back to calendar', () => {
    const card: Card = { anniversary: null };
    const b = benefit('monthly', 'anniversary');
    const p = periodFor(b, card, local(2026, 8, 20, 9));
    expect(p.key).toBe('2026-08');
    expect(p.start).toEqual(local(2026, 8, 1));
    expect(p.end).toEqual(local(2026, 9, 1));
  });

  it('anniversary anchor with an unparseable anniversary falls back to calendar', () => {
    const b = benefit('monthly', 'anniversary');
    for (const bad of ['', 'not-a-date', '2026-13-40']) {
      const card: Card = { anniversary: bad };
      const p = periodFor(b, card, local(2026, 8, 20, 9));
      expect(p.key).toBe('2026-08');
      expect(Number.isNaN(p.start.getTime())).toBe(false);
      expect(Number.isNaN(p.end.getTime())).toBe(false);
    }
  });

  it('anniversary boundaries tile without gaps', () => {
    const card: Card = { anniversary: '2026-01-31' };
    const b = benefit('quarterly', 'anniversary');
    const before = periodFor(b, card, local(2026, 4, 29, 23, 59, 59));
    const at = periodFor(b, card, local(2026, 4, 30, 0, 0, 0));
    expect(before.key).toBe('A2026-01-31');
    expect(at.key).toBe('A2026-04-30');
  });
});

describe('periodFor — calendar anchor', () => {
  it('PE-4 — calendar semiannual across the Dec 31 to Jan 1 boundary', () => {
    const b = benefit('semiannual', 'calendar');
    const before = periodFor(b, undefined, local(2026, 12, 31, 12));
    expect(before).toEqual({ start: local(2026, 7, 1), end: local(2027, 1, 1), key: '2026-07' });

    const after = periodFor(b, undefined, local(2027, 1, 1, 12));
    expect(after).toEqual({ start: local(2027, 1, 1), end: local(2027, 7, 1), key: '2027-01' });

    expect(before.key).not.toBe(after.key);
  });

  it('PE-5 — now at exact local midnight on a boundary', () => {
    const b = benefit('monthly', 'calendar');
    const atMidnight = periodFor(b, undefined, local(2026, 9, 1, 0, 0, 0));
    expect(atMidnight).toEqual({ start: local(2026, 9, 1), end: local(2026, 10, 1), key: '2026-09' });

    const justBefore = periodFor(b, undefined, local(2026, 8, 31, 23, 59, 59));
    expect(justBefore).toEqual({ start: local(2026, 8, 1), end: local(2026, 9, 1), key: '2026-08' });
  });

  it('PE-6 — a benefit added mid-period shows the in-flight window', () => {
    const b = benefit('monthly', 'calendar');
    const p = periodFor(b, undefined, local(2026, 8, 20, 9));
    expect(p).toEqual({ start: local(2026, 8, 1), end: local(2026, 9, 1), key: '2026-08' });
  });

  it('annual calendar cadence uses the uniform key format', () => {
    const b = benefit('annual', 'calendar');
    const p = periodFor(b, undefined, local(2026, 6, 15));
    expect(p.start).toEqual(local(2026, 1, 1));
    expect(p.end).toEqual(local(2027, 1, 1));
    expect(p.key).toBe('2026-01');
  });
});

describe('clampDay', () => {
  it('never overflows into the following month', () => {
    const expected = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 0; m < 12; m++) {
      const d = clampDay(2026, m, 31);
      expect(d.getMonth()).toBe(m);
      expect(d.getDate()).toBe(expected[m]);
    }
  });

  it('respects leap years', () => {
    expect(clampDay(2024, 1, 31).getDate()).toBe(29);
    expect(clampDay(2026, 1, 31).getDate()).toBe(28);
  });
});

describe('daysLeft', () => {
  it('PE-7 — DST fall-back does not distort the count', () => {
    const now = local(2026, 10, 31, 12);
    const end = local(2026, 11, 3, 12);
    expect(daysLeft(now, end)).toBe(3);
  });

  it('PE-8 — DST spring-forward does not distort the count', () => {
    const now = local(2026, 3, 7, 12);
    const end = local(2026, 3, 10, 12);
    expect(daysLeft(now, end)).toBe(3);
  });

  it('a window ending today reports zero days left', () => {
    const now = local(2026, 8, 31, 23, 0, 0);
    const end = local(2026, 8, 31, 0, 0, 0);
    expect(daysLeft(now, end)).toBe(0);
  });
});

describe('resolveBenefitValue', () => {
  it('PE-9 — Uber Cash resolves to 20 in December and 15 otherwise', () => {
    const b: Benefit = {
      value: 15,
      displayValue: null,
      cadence: 'monthly',
      anchor: 'calendar',
      valueOverrides: { M12: 20 },
    };
    const dec = periodFor(b, undefined, local(2026, 12, 5));
    const nov = periodFor(b, undefined, local(2026, 11, 5));
    expect(resolveBenefitValue(b, dec)).toBe(20);
    expect(resolveBenefitValue(b, nov)).toBe(15);
  });

  it('override suffixes are derived from the window start', () => {
    const monthly: Benefit = { value: 1, displayValue: null, cadence: 'monthly', anchor: 'calendar', valueOverrides: { M3: 99 } };
    const quarterly: Benefit = { value: 1, displayValue: null, cadence: 'quarterly', anchor: 'calendar', valueOverrides: { Q2: 99 } };
    const semiannual: Benefit = { value: 1, displayValue: null, cadence: 'semiannual', anchor: 'calendar', valueOverrides: { H2: 99 } };
    const annual: Benefit = { value: 1, displayValue: null, cadence: 'annual', anchor: 'calendar', valueOverrides: { M1: 99 } };

    expect(resolveBenefitValue(monthly, periodFor(monthly, undefined, local(2026, 3, 15)))).toBe(99);
    expect(resolveBenefitValue(quarterly, periodFor(quarterly, undefined, local(2026, 5, 15)))).toBe(99);
    expect(resolveBenefitValue(semiannual, periodFor(semiannual, undefined, local(2026, 9, 15)))).toBe(99);
    // annual benefits ignore valueOverrides entirely
    expect(resolveBenefitValue(annual, periodFor(annual, undefined, local(2026, 1, 15)))).toBe(1);
  });

  it('a null value propagates for display but excludes from dollar math', () => {
    const b: Benefit = { value: null, displayValue: 'Up to 85k pts', cadence: 'annual', anchor: 'calendar', valueOverrides: null };
    const p = periodFor(b, undefined, local(2026, 1, 15));
    expect(resolveBenefitValue(b, p)).toBeNull();
  });
});

describe('PE-10 — key format snapshot', () => {
  it('pins the exact key format across all cadences and both anchors', () => {
    const card: Card = { anniversary: '2026-01-31' };
    const cases: Array<[Benefit['cadence'], Benefit['anchor'], Card | undefined, Date]> = [
      ['monthly', 'calendar', undefined, local(2026, 8, 20)],
      ['quarterly', 'calendar', undefined, local(2026, 8, 20)],
      ['semiannual', 'calendar', undefined, local(2026, 8, 20)],
      ['annual', 'calendar', undefined, local(2026, 8, 20)],
      ['monthly', 'anniversary', card, local(2026, 2, 28)],
      ['quarterly', 'anniversary', card, local(2026, 8, 15)],
      ['semiannual', 'anniversary', card, local(2026, 5, 1)],
      ['annual', 'anniversary', card, local(2026, 6, 1)],
    ];
    const keys = cases.map(([cadence, anchor, c, now]) => periodFor(benefit(cadence, anchor), c, now).key);
    expect(keys).toEqual([
      '2026-08',
      '2026-07',
      '2026-07',
      '2026-01',
      'A2026-02-28',
      'A2026-07-31',
      'A2026-01-31',
      'A2026-01-31',
    ]);
  });

  it('the ledger key composes benefit id and period key', () => {
    expect(ledgerKey('b-123', '2026-07')).toBe('b-123|2026-07');
  });
});
