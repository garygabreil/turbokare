import { Component, inject } from '@angular/core';
import { NotificationService, ToastType } from '../../core/services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
  private readonly notifications = inject(NotificationService);
  readonly toasts = this.notifications.toasts;

  dismiss(id: number): void {
    this.notifications.dismiss(id);
  }

  cssClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'text-bg-success';
      case 'error':
        return 'text-bg-danger';
      case 'warning':
        return 'text-bg-warning';
      default:
        return 'text-bg-primary';
    }
  }

  icon(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'error':
        return 'bi-exclamation-octagon-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      default:
        return 'bi-info-circle-fill';
    }
  }
}
