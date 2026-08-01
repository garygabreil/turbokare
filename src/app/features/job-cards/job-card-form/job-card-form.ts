import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FUEL_TYPES,
  resolveVehicleMakeModel,
} from '../../../core/constants/indian-vehicles';
import {
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_STATUSES,
  createRecommendationGroup,
  defaultFollowUpDueDate,
  recommendationFollowUpNote,
  recommendationsFromArray,
} from '../../../core/utils/service-recommendations';
import { JobCardService } from '../../../core/services/job-card.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { CustomerService } from '../../../core/services/customer.service';
import { FollowUpService } from '../../../core/services/follow-up.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CustomerFollowUp, Vehicle } from '../../../core/models';
import { SearchableSelect, SelectOption } from '../../../shared/searchable-select/searchable-select';
import { VehicleMakeModel } from '../../../shared/vehicle-make-model/vehicle-make-model';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import {
  completeServiceRemindersForVehicle,
  syncServiceReminderFollowUps,
} from '../../../core/utils/service-reminder-sync';
import { loadSignal, orEmpty } from '../../../core/utils/loading-signal';

@Component({
  selector: 'app-job-card-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    SearchableSelect,
    VehicleMakeModel,
    FormKeyboardDirective,
    PageLoading,
  ],
  templateUrl: './job-card-form.html',
  styleUrl: './job-card-form.scss',
})
export class JobCardForm {
  private readonly fb = inject(FormBuilder);
  private readonly jobCardService = inject(JobCardService);
  private readonly vehicleService = inject(VehicleService);
  private readonly customerService = inject(CustomerService);
  private readonly followUpService = inject(FollowUpService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly recommendationPriorities = RECOMMENDATION_PRIORITIES;
  readonly recommendationStatuses = RECOMMENDATION_STATUSES;
  readonly fuelTypes = FUEL_TYPES;

  private readonly remoteVehicles = loadSignal(this.vehicleService.list());
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

  readonly acceptedRecommendationCount = computed(() =>
    this.recommendations.controls.filter((ctrl) => ctrl.get('status')?.value === 'accepted').length,
  );

  readonly showAddModal = signal(false);
  readonly savingCustomer = signal(false);

  readonly form = this.fb.nonNullable.group({
    vehicleId: ['', [Validators.required]],
    complaint: ['', [Validators.required, Validators.minLength(3)]],
    assignedTo: [''],
    status: ['pending' as 'pending' | 'in-progress' | 'completed' | 'delivered', [Validators.required]],
    estimatedCost: [null as number | null, [Validators.min(0)]],
    odometer: [null as number | null, [Validators.min(0)]],
    fuelType: [''],
    notes: [''],
    recommendations: this.fb.array([] as ReturnType<typeof createRecommendationGroup>[]),
  });

  readonly customerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    email: ['', [Validators.email]],
    registrationNo: ['', [Validators.required]],
    make: [''],
    model: [''],
    makeCustom: [''],
    modelCustom: [''],
    color: [''],
    year: [null as number | null],
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.jobCardService.get(this.id))
        .then((job) => {
          if (job) {
            this.form.patchValue({
              vehicleId: job.vehicleId,
              complaint: job.complaint,
              assignedTo: job.assignedTo ?? '',
              status: job.status,
              estimatedCost: job.estimatedCost ?? null,
              odometer: job.odometer ?? null,
              fuelType: job.fuelType ?? '',
              notes: job.notes ?? '',
            });
            this.matchedId.set(job.vehicleId ?? '');
            if (!job.odometer && !job.fuelType) {
              this.prefillVehicleReadings(job.vehicleId);
            }
            this.recommendations.clear();
            (job.recommendations ?? []).forEach((rec) =>
              this.recommendations.push(createRecommendationGroup(this.fb, rec)),
            );
          }
        })
        .catch(() => this.notify.error('Could not load job card.'))
        .finally(() => this.recordLoading.set(false));
    }
  }

  get recommendations(): FormArray {
    return this.form.get('recommendations') as FormArray;
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
    this.prefillVehicleReadings(id);
  }

  private prefillVehicleReadings(vehicleId: string): void {
    const vehicle = this.vehicles().find((v) => v.id === vehicleId);
    if (!vehicle) {
      return;
    }
    const currentOdo = this.form.get('odometer')?.value;
    const currentFuel = this.form.get('fuelType')?.value;
    this.form.patchValue({
      odometer: currentOdo ?? vehicle.odometer ?? null,
      fuelType: currentFuel || vehicle.fuelType || '',
    });
  }

  onVehicleSearch(text: string): void {
    this.vehicleQuery.set(text);
  }

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  recommendationInvalid(index: number, control: string): boolean {
    const c = this.recommendations.at(index).get(control);
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

  addRecommendation(): void {
    this.recommendations.push(createRecommendationGroup(this.fb));
  }

  removeRecommendation(index: number): void {
    this.recommendations.removeAt(index);
  }

  openAddCustomer(): void {
    this.customerForm.reset({
      name: '',
      phone: '',
      email: '',
      registrationNo: '',
      make: '',
      model: '',
      makeCustom: '',
      modelCustom: '',
      color: '',
      year: null,
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
    const { make, model } = resolveVehicleMakeModel(value);
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
        make,
        model,
        color: value.color.trim() || undefined,
        year: value.year,
      };
      const vehicleRef = (await this.vehicleService.create(vehiclePayload as never)) as { id: string };

      const newVehicle: Vehicle = {
        id: vehicleRef.id,
        customerId: customerRef.id,
        customerName: value.name,
        registrationNo: value.registrationNo,
        make,
        model,
        color: value.color.trim() || undefined,
        year: value.year,
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

  private async syncDeclinedFollowUps(
    jobCardId: string,
    payload: {
      customerId: string;
      customerName?: string;
      vehicleId: string;
      vehicleLabel?: string;
      recommendations: ReturnType<typeof recommendationsFromArray>;
    },
  ): Promise<void> {
    const declined = payload.recommendations.filter((rec) => rec.status === 'declined');
    if (!declined.length) {
      return;
    }

    const existing = orEmpty(await firstValueFrom(this.followUpService.list()));
    const createdBy = this.auth.user()?.name;

    for (const rec of declined) {
      const note = recommendationFollowUpNote(rec.description);
      const alreadyScheduled = existing.some(
        (fu: CustomerFollowUp) =>
          fu.sourceJobCardId === jobCardId &&
          fu.recommendationId === rec.id &&
          fu.status === 'pending',
      );
      if (alreadyScheduled) {
        continue;
      }

      await this.followUpService.create({
        customerId: payload.customerId,
        customerName: payload.customerName,
        vehicleId: payload.vehicleId,
        vehicleLabel: payload.vehicleLabel,
        note,
        dueDate: defaultFollowUpDueDate(),
        status: 'pending',
        followUpType: 'service_recommendation',
        sourceJobCardId: jobCardId,
        recommendationId: rec.id,
        createdBy,
      } as never);
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
    const recommendations = recommendationsFromArray(this.recommendations);
    const payload = {
      vehicleId: value.vehicleId,
      complaint: value.complaint,
      assignedTo: value.assignedTo,
      status: value.status,
      estimatedCost: value.estimatedCost,
      odometer: value.odometer,
      fuelType: value.fuelType || undefined,
      notes: value.notes,
      recommendations,
      customerId: vehicle?.customerId ?? '',
      customerName: vehicle?.customerName ?? '',
      vehicleLabel: vehicle
        ? [vehicle.make, vehicle.model, vehicle.registrationNo].filter(Boolean).join(' ')
        : '',
    };
    try {
      let jobCardId = this.id ?? '';
      if (this.isEdit && this.id) {
        await this.jobCardService.update(this.id, payload);
        jobCardId = this.id;
        this.notify.success('Job card updated.');
      } else {
        const ref = (await this.jobCardService.create(payload as never)) as { id: string };
        jobCardId = ref.id;
        this.notify.success('Job card created.');
      }

      if (jobCardId) {
        await this.syncDeclinedFollowUps(jobCardId, {
          customerId: payload.customerId,
          customerName: payload.customerName,
          vehicleId: payload.vehicleId,
          vehicleLabel: payload.vehicleLabel,
          recommendations,
        });
      }

      if (vehicle?.id) {
        const serviceDone =
          (value.status === 'completed' || value.status === 'delivered') &&
          value.odometer != null &&
          value.odometer > 0;

        await this.vehicleService.update(vehicle.id, {
          odometer: value.odometer ?? vehicle.odometer ?? null,
          fuelType: value.fuelType || vehicle.fuelType || undefined,
          ...(serviceDone ? { lastServiceOdometer: value.odometer } : {}),
        });

        if (serviceDone) {
          await completeServiceRemindersForVehicle(this.followUpService, vehicle.id);
        }

        const allVehicles = orEmpty(await firstValueFrom(this.vehicleService.list()));
        const allJobs = orEmpty(await firstValueFrom(this.jobCardService.list()));
        const created = await syncServiceReminderFollowUps(
          this.followUpService,
          allVehicles,
          allJobs,
          this.auth.user()?.name,
        );
        if (created > 0) {
          this.notify.success(`${created} service reminder(s) scheduled for follow-up.`);
        }
      }

      await this.router.navigate(['/job-cards']);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
