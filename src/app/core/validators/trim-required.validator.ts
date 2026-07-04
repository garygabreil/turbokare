import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function trimRequired(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return { required: true };
    }
    return null;
  };
}
