import { daysLeft, parseLocalDate } from './period';

export interface MsrInput {
  requirement: number;
  spent: number;
  deadline: string; // "YYYY-MM-DD"
}

export interface MsrStatus {
  remaining: number;
  daysToDeadline: number;
  perWeek: number;
  atRisk: boolean;
  missed: boolean;
}

export type Spend = Record<string, Record<string, number>>;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthTotal(month: Record<string, number> | undefined): number {
  if (!month) return 0;
  return Object.values(month).reduce((a, b) => a + b, 0);
}

function trailingThreeMonthWeeklyRate(spend: Spend, now: Date): number {
  let total = 0;
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    total += monthTotal(spend[key]);
  }
  return total / 13;
}

export function evaluateMsr<T extends MsrInput>(msr: T, spend: Spend, now: Date = new Date()): T & MsrStatus {
  const deadline = parseLocalDate(msr.deadline);
  const remaining = Math.max(0, msr.requirement - msr.spent);
  const daysToDeadline = deadline ? daysLeft(now, deadline) : 0;
  const perWeek = daysToDeadline > 0 ? remaining / (daysToDeadline / 7) : remaining;
  const missed = daysToDeadline < 0 && remaining > 0;

  let atRisk = false;
  if (remaining > 0) {
    const hasHistory = Object.keys(spend).length > 0;
    atRisk = hasHistory ? perWeek > trailingThreeMonthWeeklyRate(spend, now) : daysToDeadline < 14;
  }

  return { ...msr, remaining, daysToDeadline, perWeek, atRisk, missed };
}

export function sortMsrs<T extends MsrStatus>(statuses: T[]): T[] {
  return [...statuses].sort((a, b) => {
    if (a.missed !== b.missed) return a.missed ? -1 : 1;
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    if (a.atRisk) return b.perWeek - a.perWeek;
    return a.daysToDeadline - b.daysToDeadline;
  });
}
