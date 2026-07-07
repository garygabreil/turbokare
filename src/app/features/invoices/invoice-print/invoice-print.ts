import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GARAGE_PROFILE } from '../../../core/constants/garage-profile';
import { Customer, Invoice, InvoiceItem, JobCard, ServiceRecommendation, Vehicle } from '../../../core/models';
import { CustomerService } from '../../../core/services/customer.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import { JobCardService } from '../../../core/services/job-card.service';
import { NotificationService } from '../../../core/services/notification.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { isTypingTarget } from '../../../core/utils/focus-nav';
import { priorityLabel, statusLabel } from '../../../core/utils/service-recommendations';
import { calculateLineAmounts, isPartForGst, roundMoney } from '../../../core/utils/invoice-math';
import { buildServiceReminder } from '../../../core/utils/service-reminder';
import { formatReminderSummary } from '../../../core/utils/service-reminder-sync';
import { formatInr, InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { PageLoading } from '../../../shared/page-loading/page-loading';

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
  selector: 'app-invoice-print',
  standalone: true,
  imports: [RouterLink, InrCurrencyPipe, DatePipe, DecimalPipe, PageLoading],
  templateUrl: './invoice-print.html',
  styleUrl: './invoice-print.scss',
  encapsulation: ViewEncapsulation.None,
})
export class InvoicePrint implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly jobCardService = inject(JobCardService);
  private readonly vehicleService = inject(VehicleService);
  private readonly notify = inject(NotificationService);

  readonly garage = GARAGE_PROFILE;
  readonly invoice = signal<Invoice | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly jobCard = signal<JobCard | null>(null);
  readonly vehicle = signal<Vehicle | null>(null);
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
      if (invoice) {
        await this.loadPrintContext(invoice);
      }
    } catch {
      this.notify.error('Could not load invoice for printing.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPrintContext(invoice: Invoice): Promise<void> {
    if (invoice.customerId) {
      const customer = await firstValueFrom(this.customerService.get(invoice.customerId));
      this.customer.set(customer ?? null);
    }

    let jobCard: JobCard | null = null;
    if (invoice.jobCardId) {
      jobCard = (await firstValueFrom(this.jobCardService.get(invoice.jobCardId))) ?? null;
    }
    if (!jobCard && invoice.customerId) {
      jobCard = await this.findLatestJobCardForCustomer(invoice.customerId);
    }
    if (jobCard) {
      this.jobCard.set(jobCard);
    }

    let vehicle: Vehicle | null = null;
    const vehicleId = jobCard?.vehicleId;
    if (vehicleId) {
      vehicle = (await firstValueFrom(this.vehicleService.get(vehicleId))) ?? null;
    }
    if (!vehicle && invoice.customerId) {
      vehicle = await this.findPrimaryVehicleForCustomer(invoice.customerId);
    }
    if (vehicle) {
      this.vehicle.set(vehicle);
    }
  }

  private async findLatestJobCardForCustomer(customerId: string): Promise<JobCard | null> {
    const jobs = await firstValueFrom(this.jobCardService.list());
    return (
      [...jobs]
        .filter((j) => j.customerId === customerId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null
    );
  }

  private async findPrimaryVehicleForCustomer(customerId: string): Promise<Vehicle | null> {
    const vehicles = await firstValueFrom(this.vehicleService.list());
    return (
      [...vehicles]
        .filter((v) => v.customerId === customerId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null
    );
  }

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
    return this.vehicle()?.registrationNo?.toUpperCase() ?? '—';
  }

  vehicleMakeLabel(): string {
    return this.vehicle()?.make?.toUpperCase() || '—';
  }

  vehicleModelOnlyLabel(): string {
    return this.vehicle()?.model?.toUpperCase() || '—';
  }

  vehicleYearLabel(): string {
    const year = this.vehicle()?.year;
    return year != null ? String(year) : '—';
  }

  vehicleColorLabel(): string {
    return this.vehicle()?.color?.toUpperCase() || '—';
  }

  vehicleModelLabel(): string {
    const v = this.vehicle();
    if (v?.make && v?.model) {
      const year = v.year ? ` (${v.year})` : '';
      return `${v.make} ${v.model}${year}`.toUpperCase();
    }
    return this.jobCard()?.vehicleLabel?.toUpperCase() ?? '—';
  }

  odometerLabel(): string {
    const jobKm = this.jobCard()?.odometer;
    if (jobKm != null) {
      return `${jobKm.toLocaleString('en-IN')} KMS`;
    }
    const km = this.vehicle()?.odometer;
    if (km == null) {
      return '—';
    }
    return `${km.toLocaleString('en-IN')} KMS`;
  }

  fuelTypeLabel(): string {
    return this.jobCard()?.fuelType || this.vehicle()?.fuelType || '—';
  }

  nextServiceLabel(): string {
    const vehicle = this.vehicle();
    const job = this.jobCard();
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
    return this.jobCard()?.notes?.trim() || '';
  }

  jobCardRef(): string {
    const job = this.jobCard();
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
    return this.customer()?.address?.trim() || '—';
  }

  serviceAdvisor(): string {
    return this.jobCard()?.assignedTo?.trim() || '—';
  }

  advisorPhone(): string {
    return this.garage.advisorPhone || '—';
  }

  complaints(): string[] {
    const text = this.jobCard()?.complaint?.trim();
    if (!text) {
      return [];
    }
    return text
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  recommendations(): ServiceRecommendation[] {
    return this.jobCard()?.recommendations ?? [];
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

  print(): void {
    window.print();
  }
}
