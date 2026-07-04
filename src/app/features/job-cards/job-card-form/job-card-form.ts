import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { JobCardService } from '../../../core/services/job-card.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Vehicle } from '../../../core/models';
import { SearchableSelect, SelectOption } from '../../../shared/searchable-select/searchable-select';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { loadSignal, orEmpty } from '../../../core/utils/loading-signal';

@Component({
  selector: 'app-job-card-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, SearchableSelect, FormKeyboardDirective, PageLoading],
  templateUrl: './job-card-form.html',
})
export class JobCardForm {
  private readonly fb = inject(FormBuilder);
  private readonly jobCardService = inject(JobCardService);
  private readonly vehicleService = inject(VehicleService);
  private readonly customerService = inject(CustomerService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly remoteVehicles = loadSignal(this.vehicleService.list());
  /** Vehicles created via the inline modal, kept locally until Firestore streams them back. */
  private readonly localVehicles = signal<Vehicle[]>([]);
  readonly vehicles = computed(() => {
    const remote = orEmpty(this.remoteVehicles());
    const extra = this.localVehicles().filter((lv) => !remote.some((v) => v.id === lv.id));
    return [...remote, ...extra];
  });

  readonly vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v) => ({ value: v.id ?? '', label: this.labelFor(v) })),
  );

  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.id;
  readonly submitting = signal(false);
  readonly recordLoading = signal(this.isEdit);
  readonly loading = computed(
    () => this.remoteVehicles() === undefined || (this.isEdit && this.recordLoading()),
  );
  readonly vehicleQuery = signal('');
  readonly matchedId = signal('');
  readonly noMatch = computed(() => this.vehicleQuery().trim().length > 0 && !this.matchedId());

  // Add-customer modal state
  readonly showAddModal = signal(false);
  readonly savingCustomer = signal(false);

  readonly form = this.fb.nonNullable.group({
    vehicleId: ['', [Validators.required]],
    complaint: ['', [Validators.required, Validators.minLength(3)]],
    assignedTo: [''],
    status: ['pending' as 'pending' | 'in-progress' | 'completed' | 'delivered', [Validators.required]],
    estimatedCost: [null as number | null, [Validators.min(0)]],
    notes: [''],
  });

  readonly customerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    email: ['', [Validators.email]],
    registrationNo: ['', [Validators.required]],
    make: [''],
    model: [''],
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.jobCardService.get(this.id))
        .then((job) => {
          if (job) {
            this.form.patchValue(job);
            this.matchedId.set(job.vehicleId ?? '');
          }
        })
        .catch(() => this.notify.error('Could not load job card.'))
        .finally(() => this.recordLoading.set(false));
    }
  }

  labelFor(vehicle: Vehicle): string {
    const desc = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim();
    const owner = vehicle.customerName ?? '';
    const rest = desc ? `${vehicle.registrationNo} - ${desc}` : `${vehicle.registrationNo}`;
    const label = owner ? `${owner} - ${rest}` : rest;
    return label.replace(/\s+/g, ' ').trim().toUpperCase();
  }

  onVehicleValue(id: string): void {
    this.matchedId.set(id);
    const control = this.form.get('vehicleId');
    control?.setValue(id);
    control?.markAsDirty();
  }

  onVehicleSearch(text: string): void {
    this.vehicleQuery.set(text);
  }

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  customerInvalid(control: string): boolean {
    const c = this.customerForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    input.value = digits;
    this.customerForm.get('phone')?.setValue(digits);
  }

  openAddCustomer(): void {
    this.customerForm.reset({
      name: '',
      phone: '',
      email: '',
      registrationNo: '',
      make: '',
      model: '',
    });
    this.showAddModal.set(true);
  }

  closeAddCustomer(): void {
    this.showAddModal.set(false);
  }

  async saveCustomer(): Promise<void> {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }
    this.savingCustomer.set(true);
    const value = this.customerForm.getRawValue();
    try {
      const customerRef = (await this.customerService.create({
        name: value.name,
        phone: value.phone,
        email: value.email,
      } as never)) as { id: string };

      const vehiclePayload = {
        customerId: customerRef.id,
        customerName: value.name,
        registrationNo: value.registrationNo,
        make: value.make,
        model: value.model,
      };
      const vehicleRef = (await this.vehicleService.create(vehiclePayload as never)) as { id: string };

      const newVehicle: Vehicle = {
        id: vehicleRef.id,
        customerId: customerRef.id,
        customerName: value.name,
        registrationNo: value.registrationNo,
        make: value.make,
        model: value.model,
      };
      this.localVehicles.update((list) => [...list, newVehicle]);

      this.form.get('vehicleId')?.setValue(vehicleRef.id);
      this.matchedId.set(vehicleRef.id);
      this.vehicleQuery.set('');

      this.notify.success('Customer & vehicle added.');
      this.showAddModal.set(false);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.savingCustomer.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const value = this.form.getRawValue();
    const vehicle = this.vehicles().find((v) => v.id === value.vehicleId);
    const payload = {
      ...value,
      customerId: vehicle?.customerId ?? '',
      customerName: vehicle?.customerName ?? '',
      vehicleLabel: vehicle
        ? [vehicle.make, vehicle.model, vehicle.registrationNo].filter(Boolean).join(' ')
        : '',
    };
    try {
      if (this.isEdit && this.id) {
        await this.jobCardService.update(this.id, payload);
        this.notify.success('Job card updated.');
      } else {
        await this.jobCardService.create(payload as never);
        this.notify.success('Job card created.');
      }
      await this.router.navigate(['/job-cards']);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
