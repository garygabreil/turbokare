import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly online = signal(this.readOnline());

  private wasOffline = !this.readOnline();
  private offlineNotified = false;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const onOnline = (): void => {
      this.online.set(true);
      if (this.wasOffline) {
        this.notify.success("You're back online.");
        this.wasOffline = false;
        this.offlineNotified = false;
      }
    };

    const onOffline = (): void => {
      this.online.set(false);
      this.wasOffline = true;
      if (!this.offlineNotified) {
        this.notify.warning('No internet connection.');
        this.offlineNotified = true;
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    });
  }

  private readOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
}
