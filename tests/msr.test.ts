import { describe, it, expect } from 'vitest';
import { evaluateMsr, sortMsrs, type Spend } from '../src/engine/msr';

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('evaluateMsr', () => {
  it('basic derivations', () => {
    const now = local(2026, 8, 1);
    const deadline = iso(local(2026, 8, 29)); // 28 days out
    const status = evaluateMsr({ requirement: 4000, spent: 1500, deadline }, {}, now);
    expect(status.remaining).toBe(2500);
    expect(status.daysToDeadline).toBe(28);
    expect(status.perWeek).toBe(625);
  });

  it('at risk because the pace exceeds the trailing three-month run rate', () => {
    const now = local(2026, 8, 1);
    const deadline = iso(local(2026, 8, 29)); // 28 days -> perWeek 625
    // trailing months: Jul (2026-07), Jun (2026-06), May (2026-05); total 3900 -> 300/wk
    const spend: Spend = {
      '2026-07': { dining: 1300 },
      '2026-06': { dining: 1300 },
      '2026-05': { dining: 1300 },
    };
    const status = evaluateMsr({ requirement: 4000, spent: 1500, deadline }, spend, now);
    expect(status.perWeek).toBe(625);
    expect(status.atRisk).toBe(true);
  });

  it('at risk by the no-history fallback', () => {
    const now = local(2026, 8, 1);
    const deadline = iso(local(2026, 8, 11)); // 10 days out
    const status = evaluateMsr({ requirement: 800, spent: 0, deadline }, {}, now);
    expect(status.remaining).toBe(800);
    expect(status.daysToDeadline).toBe(10);
    expect(status.atRisk).toBe(true);
  });

  it('not at risk with no history and a distant deadline', () => {
    const now = local(2026, 8, 1);
    const deadline = iso(local(2026, 9, 30)); // 60 days out
    const status = evaluateMsr({ requirement: 800, spent: 0, deadline }, {}, now);
    expect(status.atRisk).toBe(false);
  });

  it('a completed MSR is never at risk', () => {
    const now = local(2026, 8, 1);
    const deadline = iso(local(2026, 8, 2)); // tomorrow
    const status = evaluateMsr({ requirement: 4000, spent: 4000, deadline }, {}, now);
    expect(status.remaining).toBe(0);
    expect(status.atRisk).toBe(false);
  });

  it('a missed MSR is flagged and sorts first', () => {
    const now = local(2026, 8, 15);
    const deadline = iso(local(2026, 8, 1)); // 14 days in the past
    const status = evaluateMsr({ requirement: 4000, spent: 1000, deadline }, {}, now);
    expect(status.daysToDeadline).toBeLessThan(0);
    expect(status.remaining).toBe(3000);
    expect(status.missed).toBe(true);
  });
});

describe('sortMsrs', () => {
  it('sorts by risk, not by date', () => {
    const a = { label: 'A', remaining: 900, daysToDeadline: 7, perWeek: 900, atRisk: true, missed: false };
    const b = { label: 'B', remaining: 400, daysToDeadline: 7, perWeek: 400, atRisk: true, missed: false };
    const c = { label: 'C', remaining: 100, daysToDeadline: 2, perWeek: 100, atRisk: false, missed: false };
    const sorted = sortMsrs([c, b, a]);
    expect(sorted.map((s) => s.label)).toEqual(['A', 'B', 'C']);
  });

  it('a missed MSR sorts before at-risk and not-at-risk ones', () => {
    const missed = { label: 'missed', remaining: 500, daysToDeadline: -3, perWeek: 500, atRisk: true, missed: true };
    const atRisk = { label: 'at-risk', remaining: 900, daysToDeadline: 7, perWeek: 900, atRisk: true, missed: false };
    const safe = { label: 'safe', remaining: 100, daysToDeadline: 30, perWeek: 20, atRisk: false, missed: false };
    const sorted = sortMsrs([safe, atRisk, missed]);
    expect(sorted.map((s) => s.label)).toEqual(['missed', 'at-risk', 'safe']);
  });
});
