import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Standard 15-character Indian GSTIN format. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value: string | null | undefined): string {
  return (value ?? '').replace(/\s/g, '').toUpperCase();
}

export function isValidGstin(value: string | null | undefined): boolean {
  const normalized = normalizeGstin(value);
  return !normalized || GSTIN_PATTERN.test(normalized);
}

export function optionalGstinValidator(control: AbstractControl): ValidationErrors | null {
  return isValidGstin(control.value) ? null : { gstin: true };
}
