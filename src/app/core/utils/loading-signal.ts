import { computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

/** Observable → signal that stays `undefined` until the first emission. */
export function loadSignal<T>(source: Observable<T>): Signal<T | undefined> {
  return toSignal(source, { requireSync: false });
}

export function orEmpty<T>(value: T[] | undefined): T[] {
  return value ?? [];
}

export function isDataLoading(...values: Signal<unknown | undefined>[]): Signal<boolean> {
  return computed(() => values.some((sig) => sig() === undefined));
}
