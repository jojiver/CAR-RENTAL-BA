export const MS_PER_DAY = 86_400_000;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return isoDate(new Date());
}

export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function daysBetweenISO(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / MS_PER_DAY);
}

export function dowISO(iso: string): number {
  return parseISO(iso).getUTCDay();
}

export function monthKeyISO(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonthsISO(iso: string, months: number): string {
  const date = parseISO(iso);
  date.setUTCMonth(date.getUTCMonth() + months);
  return isoDate(date);
}

export function startOfWeekISO(iso: string): string {
  const date = parseISO(iso);
  const dow = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dow);
  return isoDate(date);
}

export function formatShortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 4000) {
    days.push(cursor);
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }
  return days;
}

export function eachMonth(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  let guard = 0;
  while (cursor.slice(0, 7) <= to.slice(0, 7) && guard < 120) {
    months.push(cursor.slice(0, 7));
    cursor = addMonthsISO(cursor, 1);
    guard += 1;
  }
  return months;
}
