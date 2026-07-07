import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { PartService } from '../../../core/services/part.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-part-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FormKeyboardDirective, PageLoading],
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
  readonly loading = signal(this.isEdit);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    sku: [''],
    category: [''],
    quantity: [0, [Validators.required, Validators.min(0)]],
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
        .catch(() => this.notify.error('Could not load part.'))
        .finally(() => this.loading.set(false));
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
    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      sku: raw.sku.trim() || undefined,
      reorderLevel: 5,
    };
    try {
      if (this.isEdit && this.id) {
        await this.partService.update(this.id, payload);
        this.notify.success('Part updated.');
      } else {
        await this.partService.create(payload as never);
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
