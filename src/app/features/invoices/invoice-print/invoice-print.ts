import { Component, HostListener, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Customer, Invoice, JobCard, Vehicle } from '../../../core/models';
import { InvoicePdfDownloadService } from '../../../core/services/invoice-pdf-download.service';
import { InvoicePrintContextService } from '../../../core/services/invoice-print-context.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';
import { isTypingTarget } from '../../../core/utils/focus-nav';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { InvoicePrintSheet } from '../invoice-print-sheet/invoice-print-sheet';

@Component({
  selector: 'app-invoice-print',
  standalone: true,
  imports: [RouterLink, PageLoading, InvoicePrintSheet],
  templateUrl: './invoice-print.html',
  styleUrl: './invoice-print.scss',
  encapsulation: ViewEncapsulation.None,
})
export class InvoicePrint implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pdfDownload = inject(InvoicePdfDownloadService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly contextLoader = inject(InvoicePrintContextService);
  private readonly notify = inject(NotificationService);

  readonly invoice = signal<Invoice | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly jobCard = signal<JobCard | null>(null);
  readonly vehicle = signal<Vehicle | null>(null);
  readonly loading = signal(true);
  readonly downloading = signal(false);

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
      if (invoice) {
        const context = await this.contextLoader.load(invoice);
        this.customer.set(context.customer);
        this.jobCard.set(context.jobCard);
        this.vehicle.set(context.vehicle);
      }
    } catch {
      this.notify.error('Could not load invoice for printing.');
    } finally {
      this.loading.set(false);
    }
  }

  print(): void {
    window.print();
  }

  async downloadPdf(): Promise<void> {
    const inv = this.invoice();
    if (!inv || this.downloading()) {
      return;
    }

    this.downloading.set(true);
    try {
      await this.pdfDownload.download(inv);
      this.notify.success(`Downloaded ${inv.invoiceNo} as PDF.`);
    } catch {
      this.notify.error('Could not generate PDF. Try Print A4 and save as PDF.');
    } finally {
      this.downloading.set(false);
    }
  }
}
