import { Injectable, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationLoadingService {
  readonly loading = signal(false);

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(router: Router) {
    router.events
      .pipe(
        filter(
          (e) =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
          }
          this.loading.set(true);
          return;
        }
        this.hideTimer = setTimeout(() => {
          this.loading.set(false);
          this.hideTimer = null;
        }, 120);
      });
  }
}
