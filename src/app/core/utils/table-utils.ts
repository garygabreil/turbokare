export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export function toggleSort(current: SortState, key: string): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

export function sortIconClass(key: string, sort: SortState): string {
  if (sort.key !== key) {
    return 'bi bi-arrow-down-up sort-icon-idle';
  }
  return sort.direction === 'asc' ? 'bi bi-sort-up sort-icon-active' : 'bi bi-sort-down sort-icon-active';
}

export function searchByFields<T>(
  items: T[],
  term: string,
  getters: ((item: T) => string | number | undefined | null)[],
): T[] {
  const q = term.trim().toLowerCase();
  if (!q) {
    return items;
  }
  return items.filter((item) =>
    getters.some((get) =>
      String(get(item) ?? '')
        .toLowerCase()
        .includes(q),
    ),
  );
}

export function sortItems<T>(
  items: T[],
  sort: SortState,
  accessors: Record<string, (item: T) => string | number>,
): T[] {
  const get = accessors[sort.key];
  if (!get) {
    return items;
  }
  return [...items].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
    }
    return sort.direction === 'asc' ? cmp : -cmp;
  });
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  return items.slice((current - 1) * pageSize, current * pageSize);
}
