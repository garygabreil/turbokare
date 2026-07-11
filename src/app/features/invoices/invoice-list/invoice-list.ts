import { Component, computed, inject, signal } from '@angular/core';
import { InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InvoicePdfDownloadService } from '../../../core/services/invoice-pdf-download.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';
import { InvoiceStatus } from '../../../core/models';
import { Pagination } from '../../../shared/pagination/pagination';
import { DayFilter } from '../../../shared/day-filter/day-filter';
import { ListSearch } from '../../../shared/list-search/list-search';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { isDataLoading, loadSignal, orEmpty } from '../../../core/utils/loading-signal';
import {
  applyDayFilter,
  DayFilterMode,
  rowNumber as calcRowNumber,
  todayDateInput,
} from '../../../core/utils/date-filter';
import {
  paginateItems,
  searchByFields,
  sortIconClass,
  sortItems,
  SortState,
  toggleSort,
} from '../../../core/utils/table-utils';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [RouterLink, FormsModule, InrCurrencyPipe, Pagination, DayFilter, ListSearch, PageLoading],
  templateUrl: './invoice-list.html',
})
export class InvoiceList {
  private readonly invoiceService = inject(InvoiceService);
  private readonly notify = inject(NotificationService);
  private readonly pdfDownload = inject(InvoicePdfDownloadService);

  private readonly invoices = loadSignal(this.invoiceService.list());
  readonly loading = isDataLoading(this.invoices);
  readonly downloadingId = signal<string | null>(null);
  readonly dayMode = signal<DayFilterMode>('today');
  readonly viewDate = signal(todayDateInput());
  readonly search = signal('');
  readonly sort = signal<SortState>({ key: 'createdAt', direction: 'desc' });
  readonly pageSize = 8;
  readonly page = signal(1);

  readonly dayFiltered = computed(() =>
    applyDayFilter(orEmpty(this.invoices()), (i) => i.createdAt, this.dayMode(), this.viewDate()),
  );

  readonly summary = computed(() => {
    const items = this.dayFiltered();
    return {
      total: items.length,
      billed: items.reduce((sum, i) => sum + (i.total ?? 0), 0),
      collected: items
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + (i.total ?? 0), 0),
      unpaid: items.filter((i) => i.status !== 'paid').length,
    };
  });

  readonly filtered = computed(() => {
    let items = searchByFields(this.dayFiltered(), this.search(), [
      (i) => i.invoiceNo,
      (i) => i.customerName,
      (i) => i.status,
      (i) => i.billingType,
    ]);
    return sortItems(items, this.sort(), {
      invoiceNo: (i) => i.invoiceNo ?? '',
      customer: (i) => i.customerName ?? '',
      type: (i) => i.billingType ?? '',
      total: (i) => i.total ?? 0,
      status: (i) => i.status ?? '',
      createdAt: (i) => i.createdAt ?? 0,
    });
  });

  readonly paged = computed(() => paginateItems(this.filtered(), this.page(), this.pageSize));

  rowNumber(index: number): number {
    return calcRowNumber(this.page(), this.pageSize, index);
  }

  onDayFilterChange(): void {
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setSort(key: string): void {
    this.sort.update((s) => toggleSort(s, key));
    this.page.set(1);
  }

  sortIcon(key: string): string {
    return sortIconClass(key, this.sort());
  }

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

  async downloadInvoice(id: string | undefined, invoiceNo: string): Promise<void> {
    if (!id || this.downloadingId()) {
      return;
    }
    this.downloadingId.set(id);
    try {
      await this.pdfDownload.downloadById(id);
      this.notify.success(`Downloaded ${invoiceNo} as PDF.`);
    } catch {
      this.notify.error('Could not download PDF.');
    } finally {
      this.downloadingId.set(null);
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
