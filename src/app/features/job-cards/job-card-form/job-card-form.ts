import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { JobCardService } from '../../../core/services/job-card.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-job-card-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './job-card-form.html',
})
export class JobCardForm {
  private readonly fb = inject(FormBuilder);
  private readonly jobCardService = inject(JobCardService);
  private readonly vehicleService = inject(VehicleService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly vehicles = toSignal(this.vehicleService.list(), { initialValue: [] });
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.id;
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    vehicleId: ['', [Validators.required]],
    complaint: ['', [Validators.required, Validators.minLength(3)]],
    assignedTo: [''],
    status: ['pending' as 'pending' | 'in-progress' | 'completed' | 'delivered', [Validators.required]],
    estimatedCost: [null as number | null, [Validators.min(0)]],
    notes: [''],
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.jobCardService.get(this.id))
        .then((job) => {
          if (job) {
            this.form.patchValue(job);
          }
        })
        .catch(() => this.notify.error('Could not load job card.'));
    }
  }

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
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
        ? `${vehicle.make} ${vehicle.model} • ${vehicle.registrationNo}`
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
