import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../core/services/invoice.service';
import { PartService } from '../../core/services/part.service';
import { JobCardService } from '../../core/services/job-card.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { ExportService } from '../../core/services/export.service';
import { Invoice } from '../../core/models';

type ReportTab = 'sales' | 'gst' | 'inventory' | 'audit';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './reports.html',
})
export class Reports {
  private readonly invoiceService = inject(InvoiceService);
  private readonly partService = inject(PartService);
  private readonly jobCardService = inject(JobCardService);
  private readonly stockService = inject(StockMovementService);
  private readonly exporter = inject(ExportService);

  readonly tab = signal<ReportTab>('sales');

  private readonly today = new Date();
  private readonly monthStart = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  readonly fromDate = signal(this.toInputDate(this.monthStart));
  readonly toDate = signal(this.toInputDate(this.today));

  private readonly invoices = toSignal(this.invoiceService.list(), { initialValue: [] });
  private readonly parts = toSignal(this.partService.list(), { initialValue: [] });
  private readonly jobCards = toSignal(this.jobCardService.list(), { initialValue: [] });
  private readonly movements = toSignal(this.stockService.list(), { initialValue: [] });

  private toInputDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private inRange(ts: number | undefined): boolean {
    if (!ts) {
      return false;
    }
    const from = new Date(this.fromDate()).setHours(0, 0, 0, 0);
    const to = new Date(this.toDate()).setHours(23, 59, 59, 999);
    return ts >= from && ts <= to;
  }

  setTab(tab: ReportTab): void {
    this.tab.set(tab);
  }

  // ---- Sales report ----
  readonly salesInvoices = computed(() => this.invoices().filter((i) => this.inRange(i.createdAt)));

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

  // ---- GST report ----
  readonly gstInvoices = computed(() =>
    this.salesInvoices().filter((i) => i.billingType === 'gst'),
  );

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
  readonly inventoryRows = computed(() =>
    this.parts().map((p) => ({
      ...p,
      value: p.quantity * p.unitPrice,
      low: p.quantity <= p.reorderLevel,
    })),
  );

  readonly inventorySummary = computed(() => {
    const rows = this.inventoryRows();
    return {
      items: rows.length,
      units: rows.reduce((s, p) => s + p.quantity, 0),
      value: rows.reduce((s, p) => s + p.value, 0),
      lowCount: rows.filter((p) => p.low).length,
    };
  });

  // ---- Audit log ----
  readonly auditRows = computed(() => this.movements().filter((m) => this.inRange(m.createdAt)));

  readonly jobStatusSummary = computed(() => {
    const jobs = this.jobCards();
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

  // ---- CSV exports ----
  exportSales(): void {
    const rows = this.salesInvoices().map((i) => ({
      invoiceNo: i.invoiceNo,
      customer: i.customerName ?? '',
      date: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '',
      type: this.billingLabel(i),
      subtotal: (i.subtotal ?? 0).toFixed(2),
      tax: (i.taxTotal ?? 0).toFixed(2),
      total: (i.total ?? 0).toFixed(2),
      status: i.status,
    }));
    this.exporter.toCsv(
      rows,
      [
        { key: 'invoiceNo', label: 'Invoice #' },
        { key: 'customer', label: 'Customer' },
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'tax', label: 'Tax' },
        { key: 'total', label: 'Total' },
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
      taxable: (i.subtotal ?? 0).toFixed(2),
      cgst: (i.cgst ?? 0).toFixed(2),
      sgst: (i.sgst ?? 0).toFixed(2),
      igst: (i.igst ?? 0).toFixed(2),
      total: (i.total ?? 0).toFixed(2),
    }));
    this.exporter.toCsv(
      rows,
      [
        { key: 'invoiceNo', label: 'Invoice #' },
        { key: 'customer', label: 'Customer' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'rate', label: 'GST Rate' },
        { key: 'taxable', label: 'Taxable Value' },
        { key: 'cgst', label: 'CGST' },
        { key: 'sgst', label: 'SGST' },
        { key: 'igst', label: 'IGST' },
        { key: 'total', label: 'Invoice Total' },
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
      unitPrice: p.unitPrice.toFixed(2),
      value: p.value.toFixed(2),
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
        { key: 'unitPrice', label: 'Unit Price' },
        { key: 'value', label: 'Stock Value' },
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
