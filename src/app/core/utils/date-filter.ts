/** Returns YYYY-MM-DD for a date (local calendar day). */
export function toDateInput(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDateInput(): string {
  return toDateInput(new Date());
}

export function isSameDay(ts: number | undefined, dateStr: string): boolean {
  if (!ts) {
    return false;
  }
  return toDateInput(new Date(ts)) === dateStr;
}

export type DayFilterMode = 'today' | 'date' | 'all';

/** Filter by day mode and sort with today's records first, then newest. */
export function applyDayFilter<T>(
  items: T[],
  getCreatedAt: (item: T) => number | undefined,
  mode: DayFilterMode,
  dateStr: string,
): T[] {
  let rows = items;
  if (mode === 'today') {
    const today = todayDateInput();
    rows = items.filter((item) => isSameDay(getCreatedAt(item), today));
  } else if (mode === 'date') {
    rows = items.filter((item) => isSameDay(getCreatedAt(item), dateStr));
  }
  return sortTodayFirst(rows, getCreatedAt);
}

export function sortTodayFirst<T>(
  items: T[],
  getCreatedAt: (item: T) => number | undefined,
): T[] {
  const today = todayDateInput();
  return [...items].sort((a, b) => {
    const aToday = isSameDay(getCreatedAt(a), today);
    const bToday = isSameDay(getCreatedAt(b), today);
    if (aToday !== bToday) {
      return aToday ? -1 : 1;
    }
    return (getCreatedAt(b) ?? 0) - (getCreatedAt(a) ?? 0);
  });
}

export function isInDateRange(
  ts: number | undefined,
  fromDate: string,
  toDate: string,
): boolean {
  if (!ts) {
    return false;
  }
  const from = new Date(fromDate).setHours(0, 0, 0, 0);
  const to = new Date(toDate).setHours(23, 59, 59, 999);
  return ts >= from && ts <= to;
}

export function rowNumber(page: number, pageSize: number, index: number): number {
  return (page - 1) * pageSize + index + 1;
}
