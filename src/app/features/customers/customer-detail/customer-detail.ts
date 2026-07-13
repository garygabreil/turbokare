import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CustomerService } from '../../../core/services/customer.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { JobCardService } from '../../../core/services/job-card.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import { FollowUpService } from '../../../core/services/follow-up.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Customer, CustomerFollowUp, Vehicle } from '../../../core/models';
import { InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
import { VehicleMakeModel } from '../../../shared/vehicle-make-model/vehicle-make-model';
import { isDataLoading, loadSignal, orEmpty } from '../../../core/utils/loading-signal';
import {
  buildAllServiceReminders,
  reminderStatusClass,
  reminderStatusLabel,
  serviceReminderForVehicle,
} from '../../../core/utils/service-reminder';
import { formatReminderSummary } from '../../../core/utils/service-reminder-sync';
import { resolveVehicleMakeModel } from '../../../core/constants/indian-vehicles';
import { normalizeGstin, optionalGstinValidator } from '../../../core/utils/gstin.util';
import { vehiclesForCustomer } from '../../../core/utils/customer-vehicles';

export interface ServiceHistoryRow {
  id: string;
  kind: 'job' | 'invoice';
  date: number;
  title: string;
  vehicleLabel: string;
  status: string;
  amount?: number;
  link: string[];
}

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    InrCurrencyPipe,
    PageLoading,
    FormKeyboardDirective,
    VehicleMakeModel,
  ],
  templateUrl: './customer-detail.html',
})
export class CustomerDetail implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly customerService = inject(CustomerService);
  private readonly vehicleService = inject(VehicleService);
  private readonly jobCardService = inject(JobCardService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly followUpService = inject(FollowUpService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly customerId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly customer = signal<Customer | null>(null);
  readonly recordLoading = signal(true);
  readonly editing = signal(false);
  readonly savingProfile = signal(false);
  readonly savingFollowUp = signal(false);
  readonly showDoneFollowUps = signal(false);
  readonly selectedVehicle = signal<Vehicle | null>(null);
  readonly showAddVehicle = signal(false);
  readonly savingVehicle = signal(false);

  readonly addVehicleForm = this.fb.nonNullable.group({
    registrationNo: ['', [Validators.required]],
    make: [''],
    model: [''],
    makeCustom: [''],
    modelCustom: [''],
    color: [''],
    year: [null as number | null],
    fuelType: [''],
  });

  private readonly vehicles = loadSignal(this.vehicleService.list());
  private readonly jobCards = loadSignal(this.jobCardService.list());
  private readonly invoices = loadSignal(this.invoiceService.list());
  private readonly followUps = loadSignal(this.followUpService.list());

  readonly dataLoading = isDataLoading(
    this.vehicles,
    this.jobCards,
    this.invoices,
    this.followUps,
  );

  readonly loading = computed(() => this.recordLoading() || this.dataLoading());

  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    email: ['', [Validators.email]],
    address: [''],
    gstin: ['', [optionalGstinValidator]],
  });

  readonly followUpForm = this.fb.nonNullable.group({
    note: ['', [Validators.required, Validators.minLength(3)]],
    dueDate: [this.todayInput(), [Validators.required]],
    vehicleId: [''],
  });

  readonly customerVehicles = computed(() =>
    vehiclesForCustomer(
      this.customerId,
      this.customer()?.name,
      orEmpty(this.vehicles()),
      this.customerJobs(),
    ),
  );

  readonly customerJobs = computed(() =>
    orEmpty(this.jobCards()).filter((j) => j.customerId === this.customerId),
  );

  readonly customerInvoices = computed(() =>
    orEmpty(this.invoices()).filter((i) => i.customerId === this.customerId),
  );

  readonly pendingFollowUps = computed(() =>
    orEmpty(this.followUps())
      .filter((f) => f.customerId === this.customerId && f.status === 'pending')
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
  );

  readonly doneFollowUps = computed(() =>
    orEmpty(this.followUps())
      .filter((f) => f.customerId === this.customerId && f.status === 'done')
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
  );

  readonly summary = computed(() => {
    const jobs = this.customerJobs();
    const invoices = this.customerInvoices();
    return {
      vehicles: this.customerVehicles().length,
      jobs: jobs.length,
      spent: invoices
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + (i.total ?? 0), 0),
      pendingFollowUps: this.pendingFollowUps().length,
    };
  });

  readonly serviceHistory = computed<ServiceHistoryRow[]>(() => {
    const jobs: ServiceHistoryRow[] = this.customerJobs().map((j) => ({
      id: j.id ?? '',
      kind: 'job',
      date: j.createdAt ?? 0,
      title: j.complaint,
      vehicleLabel: j.vehicleLabel ?? '—',
      status: j.status,
      amount: j.estimatedCost ?? undefined,
      link: j.id ? ['/job-cards', j.id, 'edit'] : ['/job-cards'],
    }));

    const invoices: ServiceHistoryRow[] = this.customerInvoices().map((i) => ({
      id: i.id ?? '',
      kind: 'invoice',
      date: i.createdAt ?? 0,
      title: i.invoiceNo,
      vehicleLabel: '—',
      status: i.status,
      amount: i.total,
      link: i.id ? ['/invoices', i.id, 'edit'] : ['/invoices'],
    }));

    return [...jobs, ...invoices].sort((a, b) => b.date - a.date);
  });

  readonly selectedVehicleJobs = computed(() => {
    const vehicle = this.selectedVehicle();
    if (!vehicle?.id) {
      return [];
    }
    return this.customerJobs()
      .filter((j) => j.vehicleId === vehicle.id)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  });

  readonly selectedVehicleFollowUps = computed(() => {
    const vehicle = this.selectedVehicle();
    if (!vehicle?.id) {
      return [];
    }
    return this.pendingFollowUps().filter((f) => f.vehicleId === vehicle.id);
  });

  readonly selectedVehicleReminder = computed(() => {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return null;
    }
    return serviceReminderForVehicle(vehicle.id, orEmpty(this.vehicles()), orEmpty(this.jobCards()));
  });

  readonly customerServiceReminders = computed(() =>
    buildAllServiceReminders(
      this.customerVehicles(),
      orEmpty(this.jobCards()),
    ),
  );

  readonly reminderStatusClass = reminderStatusClass;
  readonly reminderStatusLabel = reminderStatusLabel;
  readonly formatReminderSummary = formatReminderSummary;

  vehicleJobCount(vehicleId: string | undefined): number {
    if (!vehicleId) {
      return 0;
    }
    return this.customerJobs().filter((j) => j.vehicleId === vehicleId).length;
  }

  openVehicle(vehicle: Vehicle): void {
    this.selectedVehicle.set(vehicle);
  }

  closeVehicle(): void {
    this.selectedVehicle.set(null);
  }

  openAddVehicle(): void {
    this.addVehicleForm.reset({
      registrationNo: '',
      make: '',
      model: '',
      makeCustom: '',
      modelCustom: '',
      color: '',
      year: null,
      fuelType: '',
    });
    this.showAddVehicle.set(true);
  }

  closeAddVehicle(): void {
    this.showAddVehicle.set(false);
  }

  vehicleInvalid(control: string): boolean {
    const c = this.addVehicleForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  async saveVehicle(): Promise<void> {
    if (this.addVehicleForm.invalid) {
      this.addVehicleForm.markAllAsTouched();
      return;
    }
    const customer = this.customer();
    if (!customer) {
      return;
    }
    this.savingVehicle.set(true);
    const value = this.addVehicleForm.getRawValue();
    const { make, model } = resolveVehicleMakeModel(value);
    try {
      await this.vehicleService.create({
        customerId: this.customerId,
        customerName: customer.name,
        registrationNo: value.registrationNo.trim(),
        make,
        model,
        color: value.color.trim() || undefined,
        year: value.year,
        fuelType: value.fuelType || undefined,
      } as never);
      this.notify.success('Vehicle registered.');
      this.closeAddVehicle();
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.savingVehicle.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    if (!this.customerId) {
      this.recordLoading.set(false);
      return;
    }
    try {
      const customer = await firstValueFrom(this.customerService.get(this.customerId));
      if (customer) {
        this.customer.set(customer);
        this.profileForm.patchValue({
          name: customer.name,
          phone: customer.phone,
          email: customer.email ?? '',
          address: customer.address ?? '',
          gstin: customer.gstin ?? '',
        });
      }
    } catch {
      this.notify.error('Could not load customer.');
    } finally {
      this.recordLoading.set(false);
    }
  }

  todayInput(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  vehicleLabel(vehicle: Vehicle): string {
    const desc = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim();
    return desc ? `${vehicle.registrationNo} — ${desc}` : vehicle.registrationNo;
  }

  jobStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'text-bg-success';
      case 'in-progress':
        return 'text-bg-primary';
      case 'delivered':
        return 'text-bg-secondary';
      default:
        return 'text-bg-warning';
    }
  }

  invoiceStatusClass(status: string): string {
    switch (status) {
      case 'paid':
        return 'text-bg-success';
      case 'partial':
        return 'text-bg-warning';
      default:
        return 'text-bg-danger';
    }
  }

  followUpDueClass(dueDate: string): string {
    if (!dueDate) {
      return '';
    }
    const today = this.todayInput();
    if (dueDate < today) {
      return 'text-danger fw-semibold';
    }
    if (dueDate === today) {
      return 'text-warning fw-semibold';
    }
    return '';
  }

  profileInvalid(control: string): boolean {
    const c = this.profileForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  followUpInvalid(control: string): boolean {
    const c = this.followUpForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    input.value = digits;
    this.profileForm.get('phone')?.setValue(digits);
  }

  onGstinInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = normalizeGstin(input.value);
    input.value = normalized;
    this.profileForm.get('gstin')?.setValue(normalized);
  }

  startEdit(): void {
    this.editing.set(true);
  }

  cancelEdit(): void {
    const customer = this.customer();
    if (customer) {
      this.profileForm.patchValue({
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? '',
        address: customer.address ?? '',
        gstin: customer.gstin ?? '',
      });
    }
    this.editing.set(false);
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    const value = this.profileForm.getRawValue();
    try {
      await this.customerService.update(this.customerId, {
        name: value.name,
        phone: value.phone,
        email: value.email || undefined,
        address: value.address || undefined,
        gstin: normalizeGstin(value.gstin) || undefined,
      });
      this.customer.update((c) =>
        c
          ? {
              ...c,
              name: value.name,
              phone: value.phone,
              email: value.email || undefined,
              address: value.address || undefined,
              gstin: normalizeGstin(value.gstin) || undefined,
            }
          : c,
      );
      this.notify.success('Customer updated.');
      this.editing.set(false);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.savingProfile.set(false);
    }
  }

  async addFollowUp(): Promise<void> {
    if (this.followUpForm.invalid) {
      this.followUpForm.markAllAsTouched();
      return;
    }
    const customer = this.customer();
    if (!customer) {
      return;
    }
    this.savingFollowUp.set(true);
    const value = this.followUpForm.getRawValue();
    const vehicle = this.customerVehicles().find((v) => v.id === value.vehicleId);
    try {
      await this.followUpService.create({
        customerId: this.customerId,
        customerName: customer.name,
        vehicleId: value.vehicleId || undefined,
        vehicleLabel: vehicle ? this.vehicleLabel(vehicle) : undefined,
        note: value.note.trim(),
        dueDate: value.dueDate,
        status: 'pending',
        createdBy: this.auth.user()?.name,
      } as never);
      this.followUpForm.reset({
        note: '',
        dueDate: this.todayInput(),
        vehicleId: '',
      });
      this.notify.success('Follow-up scheduled.');
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.savingFollowUp.set(false);
    }
  }

  async completeFollowUp(followUp: CustomerFollowUp): Promise<void> {
    if (!followUp.id) {
      return;
    }
    try {
      await this.followUpService.update(followUp.id, {
        status: 'done',
        completedAt: Date.now(),
      });
      this.notify.success('Follow-up marked done.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }

  async removeFollowUp(followUp: CustomerFollowUp): Promise<void> {
    if (!followUp.id || !confirm('Delete this follow-up?')) {
      return;
    }
    try {
      await this.followUpService.remove(followUp.id);
      this.notify.success('Follow-up removed.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }
}
