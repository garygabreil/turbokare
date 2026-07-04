import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { InvoiceService } from '../../../core/services/invoice.service';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BillingType, GstType, InvoiceItem } from '../../../core/models';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './invoice-form.html',
})
export class InvoiceForm {
  private readonly fb = inject(FormBuilder);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly customers = toSignal(this.customerService.list(), { initialValue: [] });
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.id;
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    invoiceNo: [this.generateInvoiceNo(), [Validators.required]],
    customerId: ['', [Validators.required]],
    billingType: ['gst' as BillingType, [Validators.required]],
    gstType: ['cgst_sgst' as GstType],
    gstPercent: [18, [Validators.min(0), Validators.max(100)]],
    customerGstin: [
      '',
      [Validators.pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)],
    ],
    status: ['unpaid' as 'unpaid' | 'partial' | 'paid', [Validators.required]],
    items: this.fb.array([this.createItem()]),
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.invoiceService.get(this.id))
        .then((invoice) => {
          if (invoice) {
            this.items.clear();
            (invoice.items ?? []).forEach((item) => this.items.push(this.createItem(item)));
            if (!this.items.length) {
              this.items.push(this.createItem());
            }
            this.form.patchValue({
              invoiceNo: invoice.invoiceNo,
              customerId: invoice.customerId,
              billingType: invoice.billingType ?? 'gst',
              gstType: invoice.gstType ?? 'cgst_sgst',
              gstPercent: invoice.gstPercent ?? 0,
              customerGstin: invoice.customerGstin ?? '',
              status: invoice.status,
            });
          }
        })
        .catch(() => this.notify.error('Could not load invoice.'));
    }
  }

  private generateInvoiceNo(): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return `INV-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private createItem(item?: InvoiceItem) {
    return this.fb.nonNullable.group({
      description: [item?.description ?? '', [Validators.required]],
      quantity: [item?.quantity ?? 1, [Validators.required, Validators.min(1)]],
      unitPrice: [item?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get isGst(): boolean {
    return this.form.get('billingType')?.value === 'gst';
  }

  addItem(): void {
    this.items.push(this.createItem());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  itemInvalid(index: number, control: string): boolean {
    const c = this.items.at(index).get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  get subtotal(): number {
    return this.items.controls.reduce((sum, ctrl) => {
      const qty = Number(ctrl.get('quantity')?.value) || 0;
      const price = Number(ctrl.get('unitPrice')?.value) || 0;
      return sum + qty * price;
    }, 0);
  }

  private get effectiveGstPercent(): number {
    return this.isGst ? Number(this.form.get('gstPercent')?.value) || 0 : 0;
  }

  get cgst(): number {
    if (!this.isGst || this.form.get('gstType')?.value !== 'cgst_sgst') {
      return 0;
    }
    return (this.subtotal * this.effectiveGstPercent) / 100 / 2;
  }

  get sgst(): number {
    return this.cgst;
  }

  get igst(): number {
    if (!this.isGst || this.form.get('gstType')?.value !== 'igst') {
      return 0;
    }
    return (this.subtotal * this.effectiveGstPercent) / 100;
  }

  get taxTotal(): number {
    return this.cgst + this.sgst + this.igst;
  }

  get total(): number {
    return this.subtotal + this.taxTotal;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const value = this.form.getRawValue();
    const customer = this.customers().find((c) => c.id === value.customerId);
    const payload = {
      invoiceNo: value.invoiceNo,
      customerId: value.customerId,
      customerName: customer?.name ?? '',
      items: value.items,
      billingType: value.billingType,
      gstType: this.isGst ? value.gstType : '',
      gstPercent: this.effectiveGstPercent,
      customerGstin: value.customerGstin ?? '',
      status: value.status,
      subtotal: this.subtotal,
      cgst: this.cgst,
      sgst: this.sgst,
      igst: this.igst,
      taxTotal: this.taxTotal,
      total: this.total,
    };
    try {
      if (this.isEdit && this.id) {
        await this.invoiceService.update(this.id, payload as never);
        this.notify.success('Invoice updated.');
      } else {
        await this.invoiceService.create(payload as never);
        this.notify.success('Invoice created.');
      }
      await this.router.navigate(['/invoices']);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
