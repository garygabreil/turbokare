import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { formatInr, InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../core/services/invoice.service';
import { PartService } from '../../core/services/part.service';
import { JobCardService } from '../../core/services/job-card.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { ExportService } from '../../core/services/export.service';
import { PrintService } from '../../core/services/print.service';
import { Invoice } from '../../core/models';
import { Pagination } from '../../shared/pagination/pagination';
import { DayFilter } from '../../shared/day-filter/day-filter';
import { ListSearch } from '../../shared/list-search/list-search';
import { PageLoading } from '../../shared/page-loading/page-loading';
import { isDataLoading, loadSignal, orEmpty } from '../../core/utils/loading-signal';
import {
  applyDayFilter,
  DayFilterMode,
  isInDateRange,
  rowNumber as calcRowNumber,
  sortTodayFirst,
  todayDateInput,
} from '../../core/utils/date-filter';
import {
  paginateItems,
  searchByFields,
  sortIconClass,
  sortItems,
  SortState,
  toggleSort,
} from '../../core/utils/table-utils';
import { isTypingTarget } from '../../core/utils/focus-nav';

type ReportTab = 'sales' | 'gst' | 'inventory' | 'audit';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, InrCurrencyPipe, DatePipe, Pagination, DayFilter, ListSearch, PageLoading],
  templateUrl: './reports.html',
})
export class Reports {
  readonly pageSize = 8;
  readonly salesPage = signal(1);
  readonly gstPage = signal(1);
  readonly inventoryPage = signal(1);
  readonly auditPage = signal(1);
  private readonly invoiceService = inject(InvoiceService);
  private readonly partService = inject(PartService);
  private readonly jobCardService = inject(JobCardService);
  private readonly stockService = inject(StockMovementService);
  private readonly exporter = inject(ExportService);
  private readonly printService = inject(PrintService);

  readonly tab = signal<ReportTab>('sales');

  readonly fromDate = signal(todayDateInput());
  readonly toDate = signal(todayDateInput());
  readonly inventoryDayMode = signal<DayFilterMode>('today');
  readonly inventoryViewDate = signal(todayDateInput());

  readonly salesSearch = signal('');
  readonly gstSearch = signal('');
  readonly inventorySearch = signal('');
  readonly auditSearch = signal('');

  readonly salesSort = signal<SortState>({ key: 'createdAt', direction: 'desc' });
  readonly gstSort = signal<SortState>({ key: 'createdAt', direction: 'desc' });
  readonly inventorySort = signal<SortState>({ key: 'name', direction: 'asc' });
  readonly auditSort = signal<SortState>({ key: 'createdAt', direction: 'desc' });

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.tab() !== 'audit' || !this.auditRows().length) {
      return;
    }
    if (isTypingTarget(event.target)) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.printAudit();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.printAudit();
    }
  }

  private readonly invoices = loadSignal(this.invoiceService.list());
  private readonly parts = loadSignal(this.partService.list());
  private readonly jobCards = loadSignal(this.jobCardService.list());
  private readonly movements = loadSignal(this.stockService.list());

  readonly loading = isDataLoading(this.invoices, this.parts, this.jobCards, this.movements);

  private readonly dateFilteredInvoices = computed(() =>
    sortTodayFirst(
      orEmpty(this.invoices()).filter((i) => this.inRange(i.createdAt)),
      (i) => i.createdAt,
    ),
  );

  private inRange(ts: number | undefined): boolean {
    return isInDateRange(ts, this.fromDate(), this.toDate());
  }

  setTodayRange(): void {
    const today = todayDateInput();
    this.fromDate.set(today);
    this.toDate.set(today);
    this.resetPages();
  }

  rowNumber(page: number, index: number): number {
    return calcRowNumber(page, this.pageSize, index);
  }

  onInventoryDayFilterChange(): void {
    this.inventoryPage.set(1);
  }

  onSearch(tab: ReportTab, value: string): void {
    switch (tab) {
      case 'sales':
        this.salesSearch.set(value);
        this.salesPage.set(1);
        break;
      case 'gst':
        this.gstSearch.set(value);
        this.gstPage.set(1);
        break;
      case 'inventory':
        this.inventorySearch.set(value);
        this.inventoryPage.set(1);
        break;
      case 'audit':
        this.auditSearch.set(value);
        this.auditPage.set(1);
        break;
    }
  }

  setSort(tab: ReportTab, key: string): void {
    switch (tab) {
      case 'sales':
        this.salesSort.update((s) => toggleSort(s, key));
        this.salesPage.set(1);
        break;
      case 'gst':
        this.gstSort.update((s) => toggleSort(s, key));
        this.gstPage.set(1);
        break;
      case 'inventory':
        this.inventorySort.update((s) => toggleSort(s, key));
        this.inventoryPage.set(1);
        break;
      case 'audit':
        this.auditSort.update((s) => toggleSort(s, key));
        this.auditPage.set(1);
        break;
    }
  }

  sortIcon(tab: ReportTab, key: string): string {
    const sort =
      tab === 'sales'
        ? this.salesSort()
        : tab === 'gst'
          ? this.gstSort()
          : tab === 'inventory'
            ? this.inventorySort()
            : this.auditSort();
    return sortIconClass(key, sort);
  }

  setTab(tab: ReportTab): void {
    this.tab.set(tab);
  }

  private resetPages(): void {
    this.salesPage.set(1);
    this.gstPage.set(1);
    this.inventoryPage.set(1);
    this.auditPage.set(1);
  }

  onFromDate(value: string): void {
    this.fromDate.set(value);
    this.resetPages();
  }

  onToDate(value: string): void {
    this.toDate.set(value);
    this.resetPages();
  }

  // ---- Sales report ----
  readonly salesInvoices = computed(() => {
    let items = searchByFields(this.dateFilteredInvoices(), this.salesSearch(), [
      (i) => i.invoiceNo,
      (i) => i.customerName,
      (i) => i.status,
    ]);
    return sortItems(items, this.salesSort(), {
      invoiceNo: (i) => i.invoiceNo ?? '',
      createdAt: (i) => i.createdAt ?? 0,
      customer: (i) => i.customerName ?? '',
      type: (i) => i.billingType ?? '',
      subtotal: (i) => i.subtotal ?? 0,
      tax: (i) => i.taxTotal ?? 0,
      total: (i) => i.total ?? 0,
      status: (i) => i.status ?? '',
    });
  });

  readonly salesSummary = computed(() => {
    const rows = this.salesInvoices();
    return {
      count: rows.length,
      subtotal: rows.reduce((s, i) => s + (i.subtotal ?? 0), 0),
      tax: rows.reduce((s, i) => s + (i.taxTotal ?? 0), 0),
      total: rows.reduce((s, i) => s + (i.total ?? 0), 0),
      paid: rows.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total ?? 0), 0),
      outstanding: rows
        .filter((i) => i.status !== 'paid')
        .reduce((s, i) => s + (i.total ?? 0), 0),
    };
  });

  readonly pagedSales = computed(() =>
    paginateItems(this.salesInvoices(), this.salesPage(), this.pageSize),
  );

  // ---- GST report ----
  readonly gstInvoices = computed(() => {
    let items = this.dateFilteredInvoices().filter((i) => i.billingType === 'gst');
    items = searchByFields(items, this.gstSearch(), [
      (i) => i.invoiceNo,
      (i) => i.customerName,
      (i) => i.customerGstin,
    ]);
    return sortItems(items, this.gstSort(), {
      invoiceNo: (i) => i.invoiceNo ?? '',
      customer: (i) => i.customerName ?? '',
      gstin: (i) => i.customerGstin ?? '',
      rate: (i) => i.gstPercent ?? 0,
      subtotal: (i) => i.subtotal ?? 0,
      cgst: (i) => i.cgst ?? 0,
      sgst: (i) => i.sgst ?? 0,
      igst: (i) => i.igst ?? 0,
      total: (i) => i.total ?? 0,
    });
  });

  readonly pagedGst = computed(() => paginateItems(this.gstInvoices(), this.gstPage(), this.pageSize));

  readonly gstSummary = computed(() => {
    const rows = this.gstInvoices();
    return {
      taxable: rows.reduce((s, i) => s + (i.subtotal ?? 0), 0),
      cgst: rows.reduce((s, i) => s + (i.cgst ?? 0), 0),
      sgst: rows.reduce((s, i) => s + (i.sgst ?? 0), 0),
      igst: rows.reduce((s, i) => s + (i.igst ?? 0), 0),
      total: rows.reduce((s, i) => s + (i.taxTotal ?? 0), 0),
    };
  });

  // ---- Inventory report ----
  readonly inventoryRows = computed(() => {
    const filtered = applyDayFilter(
      orEmpty(this.parts()),
      (p) => p.createdAt,
      this.inventoryDayMode(),
      this.inventoryViewDate(),
    );
    let items = searchByFields(filtered, this.inventorySearch(), [
      (p) => p.name,
      (p) => p.sku,
      (p) => p.category,
    ]);
    items = sortItems(items, this.inventorySort(), {
      name: (p) => p.name ?? '',
      sku: (p) => p.sku ?? '',
      quantity: (p) => p.quantity ?? 0,
      unitPrice: (p) => p.unitPrice ?? 0,
      value: (p) => (p.quantity ?? 0) * (p.unitPrice ?? 0),
    });
    return items.map((p) => ({
      ...p,
      value: p.quantity * p.unitPrice,
      low: p.quantity <= p.reorderLevel,
    }));
  });

  readonly inventorySummary = computed(() => {
    const rows = this.inventoryRows();
    return {
      items: rows.length,
      units: rows.reduce((s, p) => s + p.quantity, 0),
      value: rows.reduce((s, p) => s + p.value, 0),
      lowCount: rows.filter((p) => p.low).length,
    };
  });

  readonly pagedInventory = computed(() =>
    paginateItems(this.inventoryRows(), this.inventoryPage(), this.pageSize),
  );

  // ---- Audit log ----
  readonly auditRows = computed(() => {
    let items = sortTodayFirst(
      orEmpty(this.movements()).filter((m) => this.inRange(m.createdAt)),
      (m) => m.createdAt,
    );
    items = searchByFields(items, this.auditSearch(), [
      (m) => m.partName,
      (m) => m.sku,
      (m) => m.type,
      (m) => m.reason,
      (m) => m.performedBy,
    ]);
    return sortItems(items, this.auditSort(), {
      createdAt: (m) => m.createdAt ?? 0,
      part: (m) => m.partName ?? '',
      type: (m) => m.type ?? '',
      quantity: (m) => m.quantity ?? 0,
      before: (m) => m.balanceBefore ?? 0,
      after: (m) => m.balanceAfter ?? 0,
      reason: (m) => m.reason ?? '',
      by: (m) => m.performedBy ?? '',
    });
  });

  readonly pagedAudit = computed(() =>
    paginateItems(this.auditRows(), this.auditPage(), this.pageSize),
  );

  readonly jobStatusSummary = computed(() => {
    const jobs = orEmpty(this.jobCards());
    return {
      pending: jobs.filter((j) => j.status === 'pending').length,
      inProgress: jobs.filter((j) => j.status === 'in-progress').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      delivered: jobs.filter((j) => j.status === 'delivered').length,
    };
  });

  billingLabel(invoice: Invoice): string {
    return invoice.billingType === 'gst' ? `GST ${invoice.gstPercent}%` : 'Non-GST';
  }

  printAudit(): void {
    const rows = this.auditRows().map((m) => [
      m.createdAt ? new Date(m.createdAt).toLocaleString() : '',
      m.partName ?? '',
      (m.type ?? '').toUpperCase(),
      String(m.quantity ?? ''),
      String(m.balanceBefore ?? ''),
      String(m.balanceAfter ?? ''),
      m.reason ?? '',
      m.performedBy ?? '',
    ]);
    this.printService.printTable(
      `Stock Audit Log (${this.fromDate()} to ${this.toDate()})`,
      ['Date', 'Part', 'Movement', 'Qty', 'Before', 'After', 'Reason', 'By'],
      rows,
    );
  }

  // ---- CSV exports ----
  exportSales(): void {
    const rows = this.salesInvoices().map((i) => ({
      invoiceNo: i.invoiceNo,
      customer: i.customerName ?? '',
      date: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '',
      type: this.billingLabel(i),
      subtotal: formatInr(i.subtotal),
      tax: formatInr(i.taxTotal),
      total: formatInr(i.total),
      status: i.status,
    }));
    this.exporter.toCsv(
      rows,
      [
        { key: 'invoiceNo', label: 'Invoice #' },
        { key: 'customer', label: 'Customer' },
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'subtotal', label: 'Subtotal (₹)' },
        { key: 'tax', label: 'Tax (₹)' },
        { key: 'total', label: 'Total (₹)' },
        { key: 'status', label: 'Status' },
      ],
      `sales-report-${this.fromDate()}_to_${this.toDate()}`,
    );
  }

  exportGst(): void {
    const rows = this.gstInvoices().map((i) => ({
      invoiceNo: i.invoiceNo,
      customer: i.customerName ?? '',
      gstin: i.customerGstin ?? '',
      rate: `${i.gstPercent}%`,
      taxable: formatInr(i.subtotal),
      cgst: formatInr(i.cgst),
      sgst: formatInr(i.sgst),
      igst: formatInr(i.igst),
      total: formatInr(i.total),
    }));
    this.exporter.toCsv(
      rows,
      [
        { key: 'invoiceNo', label: 'Invoice #' },
        { key: 'customer', label: 'Customer' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'rate', label: 'GST Rate' },
        { key: 'taxable', label: 'Taxable Value (₹)' },
        { key: 'cgst', label: 'CGST (₹)' },
        { key: 'sgst', label: 'SGST (₹)' },
        { key: 'igst', label: 'IGST (₹)' },
        { key: 'total', label: 'Invoice Total (₹)' },
      ],
      `gst-report-${this.fromDate()}_to_${this.toDate()}`,
    );
  }

  exportInventory(): void {
    const rows = this.inventoryRows().map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category ?? '',
      quantity: p.quantity,
      reorderLevel: p.reorderLevel,
      unitPrice: formatInr(p.unitPrice),
      value: formatInr(p.value),
      status: p.low ? 'LOW STOCK' : 'OK',
    }));
    this.exporter.toCsv(
      rows,
      [
        { key: 'name', label: 'Part' },
        { key: 'sku', label: 'SKU' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'reorderLevel', label: 'Reorder Level' },
        { key: 'unitPrice', label: 'Unit Price (₹)' },
        { key: 'value', label: 'Stock Value (₹)' },
        { key: 'status', label: 'Status' },
      ],
      'inventory-report',
    );
  }

  exportAudit(): void {
    const rows = this.auditRows().map((m) => ({
      date: m.createdAt ? new Date(m.createdAt).toLocaleString() : '',
      part: m.partName,
      sku: m.sku ?? '',
      type: m.type,
      quantity: m.quantity,
      before: m.balanceBefore,
      after: m.balanceAfter,
      reason: m.reason ?? '',
      by: m.performedBy ?? '',
    }));
    this.exporter.toCsv(
      rows,
      [
        { key: 'date', label: 'Date' },
        { key: 'part', label: 'Part' },
        { key: 'sku', label: 'SKU' },
        { key: 'type', label: 'Movement' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'before', label: 'Balance Before' },
        { key: 'after', label: 'Balance After' },
        { key: 'reason', label: 'Reason' },
        { key: 'by', label: 'Performed By' },
      ],
      `stock-audit-${this.fromDate()}_to_${this.toDate()}`,
    );
  }

  movementClass(type: string): string {
    switch (type) {
      case 'in':
        return 'text-bg-success';
      case 'out':
        return 'text-bg-warning';
      default:
        return 'text-bg-secondary';
    }
  }
}
