import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { trimRequired } from '../../../core/validators/trim-required.validator';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FormKeyboardDirective],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly submitting = signal(false);
  readonly authError = signal('');
  readonly year = new Date().getFullYear();

  readonly form = this.fb.nonNullable.group({
    username: ['', [trimRequired()]],
    password: ['', [trimRequired()]],
  });

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  errorMessage(control: string): string {
    const c = this.form.get(control);
    if (!c?.errors) {
      return '';
    }
    if (c.errors['required']) {
      return control === 'username' ? 'Username is required.' : 'Password is required.';
    }
    return 'Invalid value.';
  }

  async submit(): Promise<void> {
    this.authError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { username, password } = this.form.getRawValue();
    try {
      const user = await this.auth.login(username, password);
      this.notify.success(`Welcome back, ${user.name}!`);
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      const message = (err as Error).message;
      this.authError.set(message);
      this.notify.error(message);
    } finally {
      this.submitting.set(false);
    }
  }
}
