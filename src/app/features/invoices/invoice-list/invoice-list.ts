import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InvoiceService } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';
import { InvoiceStatus } from '../../../core/models';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './invoice-list.html',
})
export class InvoiceList {
  private readonly invoiceService = inject(InvoiceService);
  private readonly notify = inject(NotificationService);

  readonly invoices = toSignal(this.invoiceService.list(), { initialValue: [] });

  statusClass(status: string): string {
    switch (status) {
      case 'paid':
        return 'text-bg-success';
      case 'partial':
        return 'text-bg-warning';
      default:
        return 'text-bg-danger';
    }
  }

  async setStatus(id: string | undefined, status: InvoiceStatus): Promise<void> {
    if (!id) {
      return;
    }
    try {
      await this.invoiceService.update(id, { status });
      this.notify.success('Invoice status updated.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }

  async remove(id: string | undefined, invoiceNo: string): Promise<void> {
    if (!id) {
      return;
    }
    if (!confirm(`Delete invoice ${invoiceNo}?`)) {
      return;
    }
    try {
      await this.invoiceService.remove(id);
      this.notify.success('Invoice deleted.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }
}
