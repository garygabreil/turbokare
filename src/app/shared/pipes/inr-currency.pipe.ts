import { CurrencyPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/** Plain-text rupee amount for exports and labels (e.g. ₹1,234.56). */
export function formatInr(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formats amounts as Indian Rupees with the ₹ symbol and 2 decimal places. */
@Pipe({
  name: 'inr',
  standalone: true,
})
export class InrCurrencyPipe implements PipeTransform {
  private readonly currency = new CurrencyPipe('en-IN');

  transform(value: number | string | null | undefined): string {
    const amount = Number(value ?? 0);
    return this.currency.transform(amount, 'INR', 'symbol', '1.2-2', 'en-IN') ?? '₹0.00';
  }
}
