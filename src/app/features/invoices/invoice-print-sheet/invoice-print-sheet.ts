import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { GARAGE_PROFILE } from '../../../core/constants/garage-profile';
import {
  Customer,
  Invoice,
  InvoiceItem,
  JobCard,
  ServiceRecommendation,
  Vehicle,
} from '../../../core/models';
import { priorityLabel, statusLabel } from '../../../core/utils/service-recommendations';
import { calculateLineAmounts, isPartForGst, roundMoney } from '../../../core/utils/invoice-math';
import { buildServiceReminder } from '../../../core/utils/service-reminder';
import { formatReminderSummary } from '../../../core/utils/service-reminder-sync';
import { formatInr, InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';

export interface PrintLine {
  description: string;
  quantity: number;
  rate: number;
  hsn: string;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

export interface SectionTotals {
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

@Component({
  selector: 'app-invoice-print-sheet',
  standalone: true,
  imports: [InrCurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './invoice-print-sheet.html',
  styleUrl: './invoice-print-sheet.scss',
  encapsulation: ViewEncapsulation.None,
})
export class InvoicePrintSheet {
  @Input({ required: true }) invoice!: Invoice;
  @Input() customer: Customer | null = null;
  @Input() jobCard: JobCard | null = null;
  @Input() vehicle: Vehicle | null = null;

  readonly garage = GARAGE_PROFILE;

  documentTitle(invoice: Invoice): string {
    return invoice.status === 'paid' ? 'INVOICE' : 'ESTIMATE';
  }

  partItems(invoice: Invoice): InvoiceItem[] {
    return (invoice.items ?? []).filter((i) => i.itemType !== 'service');
  }

  serviceItems(invoice: Invoice): InvoiceItem[] {
    return (invoice.items ?? []).filter((i) => i.itemType === 'service');
  }

  printLines(invoice: Invoice, items: InvoiceItem[]): PrintLine[] {
    const isGst = invoice.billingType === 'gst';
    const halfRate = invoice.gstPercent / 2;

    return items.map((item) => {
      const partLine = isPartForGst(item.itemType);
      const line = calculateLineAmounts(
        item.quantity,
        item.unitPrice,
        invoice.billingType,
        invoice.gstType,
        invoice.gstPercent,
        item.itemType,
      );

      return {
        description: item.description,
        quantity: item.quantity,
        rate: roundMoney(item.unitPrice),
        hsn: 'NA',
        cgstPct: isGst && invoice.gstType === 'cgst_sgst' && partLine ? halfRate : 0,
        sgstPct: isGst && invoice.gstType === 'cgst_sgst' && partLine ? halfRate : 0,
        igstPct: isGst && invoice.gstType === 'igst' && partLine ? invoice.gstPercent : 0,
        cgst: line.cgst,
        sgst: line.sgst,
        igst: line.igst,
        amount: line.amount,
      };
    });
  }

  sectionTotals(lines: PrintLine[]): SectionTotals {
    return lines.reduce(
      (acc, line) => ({
        cgst: roundMoney(acc.cgst + line.cgst),
        sgst: roundMoney(acc.sgst + line.sgst),
        igst: roundMoney(acc.igst + line.igst),
        amount: roundMoney(acc.amount + line.amount),
      }),
      { cgst: 0, sgst: 0, igst: 0, amount: 0 },
    );
  }

  vehicleRegNo(): string {
    return this.vehicle?.registrationNo?.toUpperCase() ?? '—';
  }

  vehicleMakeLabel(): string {
    return this.vehicle?.make?.toUpperCase() || '—';
  }

  vehicleModelOnlyLabel(): string {
    return this.vehicle?.model?.toUpperCase() || '—';
  }

  vehicleYearLabel(): string {
    const year = this.vehicle?.year;
    return year != null ? String(year) : '—';
  }

  vehicleColorLabel(): string {
    return this.vehicle?.color?.toUpperCase() || '—';
  }

  odometerLabel(): string {
    const jobKm = this.jobCard?.odometer;
    if (jobKm != null) {
      return `${jobKm.toLocaleString('en-IN')} KMS`;
    }
    const km = this.vehicle?.odometer;
    if (km == null) {
      return '—';
    }
    return `${km.toLocaleString('en-IN')} KMS`;
  }

  fuelTypeLabel(): string {
    return this.jobCard?.fuelType || this.vehicle?.fuelType || '—';
  }

  nextServiceLabel(): string {
    const vehicle = this.vehicle;
    const job = this.jobCard;
    if (!vehicle?.odometer) {
      return '—';
    }
    const reminder = buildServiceReminder(vehicle, job ? [job] : []);
    if (!reminder) {
      return '—';
    }
    return `${reminder.nextServiceOdometer.toLocaleString('en-IN')} km (${formatReminderSummary(reminder)})`;
  }

  jobCardNotes(): string {
    return this.jobCard?.notes?.trim() || '';
  }

  jobCardRef(): string {
    const job = this.jobCard;
    if (!job) {
      return '';
    }
    if (job.createdAt) {
      return `Job card · ${new Date(job.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}`;
    }
    return 'Job card linked';
  }

  billingLabel(invoice: Invoice): string {
    if (invoice.billingType !== 'gst') {
      return 'Non-GST';
    }
    const type = invoice.gstType === 'igst' ? 'IGST' : 'CGST+SGST';
    return `GST ${invoice.gstPercent}% (${type})`;
  }

  billToLocation(): string {
    return this.customer?.address?.trim() || '—';
  }

  assignedMechanic(): string {
    return this.invoice?.assignedMechanic?.trim() || this.jobCard?.assignedTo?.trim() || '—';
  }

  advisorPhone(): string {
    return this.garage.advisorPhone || '—';
  }

  complaints(): string[] {
    const text = this.jobCard?.complaint?.trim();
    if (!text) {
      return [];
    }
    return text
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  recommendations(): ServiceRecommendation[] {
    return this.jobCard?.recommendations ?? [];
  }

  recommendationLine(rec: ServiceRecommendation): string {
    const parts = [rec.description.trim()];
    parts.push(`(${priorityLabel(rec.priority)})`);
    if (rec.estimatedCost != null && rec.estimatedCost > 0) {
      parts.push(`— ${formatInr(rec.estimatedCost)}`);
    }
    parts.push(`[${statusLabel(rec.status)}]`);
    return parts.join(' ');
  }

  showCgstSgst(invoice: Invoice): boolean {
    return invoice.billingType === 'gst' && invoice.gstType === 'cgst_sgst';
  }

  showIgst(invoice: Invoice): boolean {
    return invoice.billingType === 'gst' && invoice.gstType === 'igst';
  }

  tableColCount(invoice: Invoice): number {
    if (this.showCgstSgst(invoice)) {
      return 10;
    }
    if (this.showIgst(invoice)) {
      return 8;
    }
    return 6;
  }
}
