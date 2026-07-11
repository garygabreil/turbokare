import { ApplicationRef, ComponentRef, createComponent, EnvironmentInjector, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InvoicePrintSheet } from '../../features/invoices/invoice-print-sheet/invoice-print-sheet';
import { Invoice } from '../models';
import { singleInvoicePdfFilename } from '../utils/invoice-export';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePrintContextService } from './invoice-print-context.service';
import { InvoiceService } from './invoice.service';

@Injectable({ providedIn: 'root' })
export class InvoicePdfDownloadService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly pdf = inject(InvoicePdfService);
  private readonly contextLoader = inject(InvoicePrintContextService);
  private readonly invoiceService = inject(InvoiceService);

  async downloadById(invoiceId: string): Promise<void> {
    const invoice = await firstValueFrom(this.invoiceService.get(invoiceId));
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    await this.download(invoice);
  }

  async download(invoice: Invoice): Promise<void> {
    const context = await this.contextLoader.load(invoice);

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
    document.body.appendChild(host);

    let ref: ComponentRef<InvoicePrintSheet> | null = null;
    try {
      ref = createComponent(InvoicePrintSheet, {
        environmentInjector: this.injector,
        hostElement: host,
      });
      ref.setInput('invoice', invoice);
      ref.setInput('customer', context.customer);
      ref.setInput('jobCard', context.jobCard);
      ref.setInput('vehicle', context.vehicle);
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();

      await this.waitForRender();

      const sheet = host.querySelector('.invoice-a4-sheet');
      if (!(sheet instanceof HTMLElement)) {
        throw new Error('Invoice sheet could not be rendered');
      }

      await this.pdf.downloadSheet(sheet, singleInvoicePdfFilename(invoice));
    } finally {
      if (ref) {
        this.appRef.detachView(ref.hostView);
        ref.destroy();
      }
      host.remove();
    }
  }

  private waitForRender(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
}
