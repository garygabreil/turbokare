import { Invoice } from '../models';
import { formatInr } from '../../shared/pipes/inr-currency.pipe';
import { DayFilterMode, todayDateInput } from './date-filter';

export function invoiceBillingLabel(invoice: Invoice): string {
  return invoice.billingType === 'gst' ? `GST ${invoice.gstPercent}%` : 'Non-GST';
}

export type InvoiceSummaryExportRow = {
  invoiceNo: string;
  customer: string;
  date: string;
  type: string;
  subtotal: string;
  tax: string;
  total: string;
  status: string;
};

export const INVOICE_SUMMARY_CSV_COLUMNS: { key: keyof InvoiceSummaryExportRow; label: string }[] = [
  { key: 'invoiceNo', label: 'Invoice #' },
  { key: 'customer', label: 'Customer' },
  { key: 'date', label: 'Date' },
  { key: 'type', label: 'Type' },
  { key: 'subtotal', label: 'Subtotal (₹)' },
  { key: 'tax', label: 'Tax (₹)' },
  { key: 'total', label: 'Total (₹)' },
  { key: 'status', label: 'Status' },
];

export function invoiceSummaryExportRows(invoices: Invoice[]): InvoiceSummaryExportRow[] {
  return invoices.map((i) => ({
    invoiceNo: i.invoiceNo,
    customer: i.customerName ?? '',
    date: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '',
    type: invoiceBillingLabel(i),
    subtotal: formatInr(i.subtotal),
    tax: formatInr(i.taxTotal),
    total: formatInr(i.total),
    status: i.status,
  }));
}

export function invoiceListExportFilename(dayMode: DayFilterMode, viewDate: string): string {
  if (dayMode === 'all') {
    return 'invoices-all';
  }
  if (dayMode === 'today') {
    return `invoices-${todayDateInput()}`;
  }
  return `invoices-${viewDate}`;
}

export type InvoiceDetailExportRow = {
  invoiceNo: string;
  customer: string;
  date: string;
  type: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  status: string;
};

export const INVOICE_DETAIL_CSV_COLUMNS: { key: keyof InvoiceDetailExportRow; label: string }[] = [
  { key: 'invoiceNo', label: 'Invoice #' },
  { key: 'customer', label: 'Customer' },
  { key: 'date', label: 'Date' },
  { key: 'type', label: 'Type' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Qty' },
  { key: 'unitPrice', label: 'Rate (₹)' },
  { key: 'lineTotal', label: 'Amount (₹)' },
  { key: 'status', label: 'Status' },
];

export function invoiceDetailExportRows(invoice: Invoice): InvoiceDetailExportRow[] {
  const shared = {
    invoiceNo: invoice.invoiceNo,
    customer: invoice.customerName ?? '',
    date: invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '',
    type: invoiceBillingLabel(invoice),
    status: invoice.status,
  };

  return invoice.items.map((item) => ({
    ...shared,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: formatInr(item.unitPrice),
    lineTotal: formatInr(item.quantity * item.unitPrice),
  }));
}

export function singleInvoiceExportFilename(invoice: Invoice): string {
  const safeNo = invoice.invoiceNo.replace(/[^\w-]+/g, '_');
  return `invoice-${safeNo}`;
}

export function singleInvoicePdfFilename(invoice: Invoice): string {
  return `${singleInvoiceExportFilename(invoice)}.pdf`;
}
