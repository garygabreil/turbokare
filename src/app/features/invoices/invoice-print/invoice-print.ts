import { DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { InvoiceService } from '../../../core/services/invoice.service';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Customer, Invoice } from '../../../core/models';
import { InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { isTypingTarget } from '../../../core/utils/focus-nav';

@Component({
  selector: 'app-invoice-print',
  standalone: true,
  imports: [RouterLink, InrCurrencyPipe, DatePipe, PageLoading],
  templateUrl: './invoice-print.html',
  styleUrl: './invoice-print.scss',
  encapsulation: ViewEncapsulation.None,
})
export class InvoicePrint implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly notify = inject(NotificationService);

  readonly invoice = signal<Invoice | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(true);

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.loading() || !this.invoice()) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.print();
      return;
    }
    if (event.key === 'Enter' && !isTypingTarget(event.target)) {
      event.preventDefault();
      this.print();
    }
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      const invoice = await firstValueFrom(this.invoiceService.get(id));
      this.invoice.set(invoice ?? null);
      if (invoice?.customerId) {
        const customer = await firstValueFrom(this.customerService.get(invoice.customerId));
        this.customer.set(customer ?? null);
      }
    } catch {
      this.notify.error('Could not load invoice for printing.');
    } finally {
      this.loading.set(false);
    }
  }

  billingLabel(invoice: Invoice): string {
    return invoice.billingType === 'gst'
      ? `GST Invoice (${invoice.gstPercent}%)`
      : 'Non-GST Invoice';
  }

  print(): void {
    window.print();
  }
}
