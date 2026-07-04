import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { VehicleService } from '../../../core/services/vehicle.service';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './vehicle-form.html',
})
export class VehicleForm {
  private readonly fb = inject(FormBuilder);
  private readonly vehicleService = inject(VehicleService);
  private readonly customerService = inject(CustomerService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly customers = toSignal(this.customerService.list(), { initialValue: [] });
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.id;
  readonly submitting = signal(false);

  private readonly currentYear = new Date().getFullYear();

  readonly form = this.fb.nonNullable.group({
    customerId: ['', [Validators.required]],
    make: ['', [Validators.required]],
    model: ['', [Validators.required]],
    registrationNo: ['', [Validators.required]],
    year: [
      null as number | null,
      [Validators.min(1950), Validators.max(this.currentYear + 1)],
    ],
    color: [''],
    odometer: [null as number | null, [Validators.min(0)]],
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.vehicleService.get(this.id))
        .then((vehicle) => {
          if (vehicle) {
            this.form.patchValue(vehicle);
          }
        })
        .catch(() => this.notify.error('Could not load vehicle.'));
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
    const customer = this.customers().find((c) => c.id === value.customerId);
    const payload = { ...value, customerName: customer?.name ?? '' };
    try {
      if (this.isEdit && this.id) {
        await this.vehicleService.update(this.id, payload);
        this.notify.success('Vehicle updated.');
      } else {
        await this.vehicleService.create(payload as never);
        this.notify.success('Vehicle added.');
      }
      await this.router.navigate(['/vehicles']);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
