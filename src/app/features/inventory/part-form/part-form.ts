import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PartService } from '../../../core/services/part.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-part-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './part-form.html',
})
export class PartForm {
  private readonly fb = inject(FormBuilder);
  private readonly partService = inject(PartService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.id;
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    sku: ['', [Validators.required]],
    category: [''],
    quantity: [0, [Validators.required, Validators.min(0)]],
    reorderLevel: [5, [Validators.required, Validators.min(0)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.partService.get(this.id))
        .then((part) => {
          if (part) {
            this.form.patchValue(part);
          }
        })
        .catch(() => this.notify.error('Could not load part.'));
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
    try {
      if (this.isEdit && this.id) {
        await this.partService.update(this.id, this.form.getRawValue());
        this.notify.success('Part updated.');
      } else {
        await this.partService.create(this.form.getRawValue());
        this.notify.success('Part added.');
      }
      await this.router.navigate(['/inventory']);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
