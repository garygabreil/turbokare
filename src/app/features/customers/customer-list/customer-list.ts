import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './customer-list.html',
})
export class CustomerList {
  private readonly customerService = inject(CustomerService);
  private readonly notify = inject(NotificationService);

  private readonly customers = toSignal(this.customerService.list(), { initialValue: [] });
  readonly search = signal('');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.customers();
    }
    return this.customers().filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term),
    );
  });

  async remove(id: string | undefined, name: string): Promise<void> {
    if (!id) {
      return;
    }
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await this.customerService.remove(id);
      this.notify.success('Customer deleted.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }
}
