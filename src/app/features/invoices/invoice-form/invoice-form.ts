import { Component, computed, inject, signal } from '@angular/core';
import { InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { InvoiceService } from '../../../core/services/invoice.service';
import { JobCardService } from '../../../core/services/job-card.service';
import { CustomerService } from '../../../core/services/customer.service';
import { PartService } from '../../../core/services/part.service';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BillingType, GstType, InvoiceItem, Part } from '../../../core/models';
import { SearchableSelect, SelectOption } from '../../../shared/searchable-select/searchable-select';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { loadSignal, orEmpty } from '../../../core/utils/loading-signal';
import {
  calculateInvoiceAmounts,
  calculateLineAmounts,
  normalizeInvoiceItem,
  roundMoney,
} from '../../../core/utils/invoice-math';
import { formatInr } from '../../../shared/pipes/inr-currency.pipe';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InrCurrencyPipe, SearchableSelect, FormKeyboardDirective, PageLoading],
  templateUrl: './invoice-form.html',
  styleUrl: './invoice-form.scss',
})
export class InvoiceForm {
  private readonly fb = inject(FormBuilder);
  private readonly invoiceService = inject(InvoiceService);
  private readonly jobCardService = inject(JobCardService);
  private readonly customerService = inject(CustomerService);
  private readonly partService = inject(PartService);
  private readonly stockService = inject(StockMovementService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly customers = loadSignal(this.customerService.list());
  private readonly parts = loadSignal(this.partService.list());
  private readonly invoices = loadSignal(this.invoiceService.list());
  readonly customerOptions = computed<SelectOption[]>(() =>
    orEmpty(this.customers()).map((c) => ({ value: c.id ?? '', label: c.name, sublabel: c.phone })),
  );
  readonly partDescriptionOptions = computed<SelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SelectOption[] = [];

    for (const part of orEmpty(this.parts())) {
      const label = part.name.trim();
      if (!label) {
        continue;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push({
        value: label.toUpperCase(),
        label: label.toUpperCase(),
        sublabel: part.sku
          ? `Part • ${part.sku.toUpperCase()} • ${formatInr(part.unitPrice)} • Stock: ${part.quantity}`
          : `Part • ${formatInr(part.unitPrice)} • Stock: ${part.quantity}`,
        data: { unitPrice: part.unitPrice, partId: part.id ?? '', source: 'part' },
      });
    }

    for (const invoice of orEmpty(this.invoices())) {
      for (const item of invoice.items ?? []) {
        const label = item.description?.trim();
        if (!label) {
          continue;
        }
        const key = label.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        options.push({
          value: label.toUpperCase(),
          label: label.toUpperCase(),
          sublabel: 'Previous invoice item',
          data: { unitPrice: item.unitPrice, source: 'history' },
        });
      }
    }

    return options;
  });
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.id;
  readonly submitting = signal(false);
  readonly recordLoading = signal(this.isEdit);
  readonly loading = computed(
    () =>
      this.customers() === undefined ||
      this.parts() === undefined ||
      this.invoices() === undefined ||
      (this.isEdit && this.recordLoading()),
  );
  private readonly originalItems = signal<InvoiceItem[]>([]);
  readonly linkedJobCardId = signal<string | null>(null);
  readonly lineStockErrors = signal<Record<string, string>>({});

  get selectedCustomerId(): string {
    return this.form.get('customerId')?.value ?? '';
  }

  onCustomerValue(id: string): void {
    const control = this.form.get('customerId');
    control?.setValue(id);
    control?.markAsDirty();
  }

  onPartDescriptionValue(index: number, text: string): void {
    this.onLineDescriptionValue(this.partItems, index, text);
  }

  onPartDescriptionSelect(index: number, opt: SelectOption): void {
    this.onLineDescriptionSelect(this.partItems, index, opt);
  }

  onPartQuantityChange(index: number): void {
    this.validateAllLineStock(true);
  }

  partLineStockError(index: number): string {
    return this.lineStockErrors()[`part-${index}`] ?? '';
  }

  private onLineDescriptionValue(array: FormArray, index: number, text: string): void {
    const row = array.at(index);
    const normalized = text.trim().toUpperCase();
    row.get('description')?.setValue(normalized);
    row.get('description')?.markAsDirty();
    this.applyPartToRow(row, normalized);
    this.validateAllLineStock(true);
  }

  private onLineDescriptionSelect(array: FormArray, index: number, opt: SelectOption): void {
    const row = array.at(index);
    const label = opt.label.toUpperCase();
    row.get('description')?.setValue(label);
    row.get('description')?.markAsDirty();

    const unitPrice = opt.data?.['unitPrice'];
    if (typeof unitPrice === 'number') {
      row.get('unitPrice')?.setValue(unitPrice);
      row.get('unitPrice')?.markAsDirty();
    }

    const partId = opt.data?.['partId'];
    if (typeof partId === 'string' && partId) {
      row.get('partId')?.setValue(partId);
    } else {
      this.applyPartToRow(row, label);
    }
    this.validateAllLineStock(true);
  }

  lineStockError(index: number): string {
    return this.partLineStockError(index);
  }

  onDescriptionValue(index: number, text: string): void {
    this.onPartDescriptionValue(index, text);
  }

  onDescriptionSelect(index: number, opt: SelectOption): void {
    this.onPartDescriptionSelect(index, opt);
  }

  onQuantityChange(index: number): void {
    this.onPartQuantityChange(index);
  }

  private applyPartToRow(row: ReturnType<FormArray['at']>, description: string): void {
    const part = this.findPartForDescription(description);
    if (part) {
      row.get('unitPrice')?.setValue(part.unitPrice);
      row.get('unitPrice')?.markAsDirty();
      row.get('partId')?.setValue(part.id ?? '');
    } else {
      row.get('partId')?.setValue('');
    }
  }

  private validateAllLineStock(showToast: boolean): void {
    const errors: Record<string, string> = {};
    this.partItems.controls.forEach((_, index) => {
      const message = this.getLineStockError(index);
      if (message) {
        errors[`part-${index}`] = message;
      }
    });
    this.lineStockErrors.set(errors);
    if (showToast && Object.keys(errors).length) {
      this.notify.error(Object.values(errors)[0]);
    }
  }

  private getLineStockError(index: number): string | null {
    const row = this.partItems.at(index);
    const part = this.resolvePart({
      partId: row.get('partId')?.value ?? '',
      description: row.get('description')?.value ?? '',
    });
    if (!part?.id) {
      return null;
    }
    const qty = Number(row.get('quantity')?.value) || 0;
    const available = this.availableQuantityForPart(part.id, index);
    if (qty > available) {
      return `Not enough stock for "${part.name.toUpperCase()}". Available: ${available}.`;
    }
    if (available === 0 && qty > 0) {
      return `"${part.name.toUpperCase()}" is out of stock.`;
    }
    return null;
  }

  private availableQuantityForPart(partId: string, excludeIndex: number): number {
    const part = orEmpty(this.parts()).find((p) => p.id === partId);
    if (!part) {
      return 0;
    }

    let usedOnOtherLines = 0;
    this.partItems.controls.forEach((ctrl, i) => {
      if (i === excludeIndex) {
        return;
      }
      if (ctrl.get('partId')?.value === partId) {
        usedOnOtherLines += Number(ctrl.get('quantity')?.value) || 0;
      }
    });

    let originalOnInvoice = 0;
    if (this.isEdit) {
      for (const item of this.originalItems()) {
        if (item.itemType === 'service') {
          continue;
        }
        const p = this.resolvePart(item);
        if (p?.id === partId) {
          originalOnInvoice += item.quantity;
        }
      }
    }

    return part.quantity + originalOnInvoice - usedOnOtherLines;
  }

  private findPartForDescription(description: string): Part | undefined {
    const key = description.trim().toLowerCase();
    if (!key) {
      return undefined;
    }
    return orEmpty(this.parts()).find((p) => p.name.trim().toLowerCase() === key);
  }

  private resolvePart(item: { partId?: string; description: string }): Part | undefined {
    if (item.partId) {
      return orEmpty(this.parts()).find((p) => p.id === item.partId);
    }
    return this.findPartForDescription(item.description);
  }

  partItemDescription(index: number): string {
    return this.partItems.at(index).get('description')?.value ?? '';
  }

  itemDescription(index: number): string {
    return this.partItemDescription(index);
  }

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
    partItems: this.fb.array([] as ReturnType<typeof this.createPartItem>[]),
    serviceItems: this.fb.array([] as ReturnType<typeof this.createServiceItem>[]),
  });

  constructor() {
    if (this.isEdit && this.id) {
      firstValueFrom(this.invoiceService.get(this.id))
        .then((invoice) => {
          if (invoice) {
            this.linkedJobCardId.set(invoice.jobCardId ?? null);
            const allItems = invoice.items ?? [];
            const parts = allItems.filter((i) => i.itemType !== 'service');
            const services = allItems.filter((i) => i.itemType === 'service');
            this.partItems.clear();
            parts.forEach((item) => this.partItems.push(this.createPartItem(item)));
            this.serviceItems.clear();
            services.forEach((item) => this.serviceItems.push(this.createServiceItem(item)));
            this.originalItems.set(structuredClone(allItems));
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
        .catch(() => this.notify.error('Could not load invoice.'))
        .finally(() => this.recordLoading.set(false));
    } else {
      const jobCardId = this.route.snapshot.queryParamMap.get('jobCardId');
      if (jobCardId) {
        this.linkedJobCardId.set(jobCardId);
        this.prefillFromJobCard(jobCardId);
      }
    }
  }

  private prefillFromJobCard(jobCardId: string): void {
    firstValueFrom(this.jobCardService.get(jobCardId))
      .then((job) => {
        if (!job) {
          return;
        }
        this.form.patchValue({ customerId: job.customerId });
        const accepted = (job.recommendations ?? []).filter((rec) => rec.status === 'accepted');
        accepted.forEach((rec) => {
          this.serviceItems.push(
            this.createServiceItem({
              description: rec.description.trim().toUpperCase(),
              quantity: 1,
              unitPrice: rec.estimatedCost ?? 0,
              itemType: 'service',
            }),
          );
        });
        if (accepted.length) {
          this.notify.success(`Added ${accepted.length} accepted service(s) from job card.`);
        }
      })
      .catch(() => this.notify.error('Could not load job card for invoice.'));
  }

  private generateInvoiceNo(): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return `INV-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private createPartItem(item?: InvoiceItem) {
    const part = item ? this.findPartForDescription(item.description) : undefined;
    return this.fb.nonNullable.group({
      description: [item?.description ?? '', [Validators.required]],
      quantity: [item?.quantity ?? 1, [Validators.required, Validators.min(1)]],
      unitPrice: [item?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      partId: [item?.partId ?? part?.id ?? ''],
    });
  }

  private createServiceItem(item?: InvoiceItem) {
    return this.fb.nonNullable.group({
      description: [item?.description ?? '', [Validators.required]],
      quantity: [item?.quantity ?? 1, [Validators.required, Validators.min(1)]],
      unitPrice: [item?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  private createItem(item?: InvoiceItem) {
    return this.createPartItem(item);
  }

  get partItems(): FormArray {
    return this.form.get('partItems') as FormArray;
  }

  get serviceItems(): FormArray {
    return this.form.get('serviceItems') as FormArray;
  }

  get items(): FormArray {
    return this.partItems;
  }

  get isGst(): boolean {
    return this.form.get('billingType')?.value === 'gst';
  }

  addPartItem(): void {
    this.partItems.push(this.createPartItem());
  }

  addServiceItem(): void {
    this.serviceItems.push(this.createServiceItem());
  }

  addItem(): void {
    this.addPartItem();
  }

  removePartItem(index: number): void {
    this.partItems.removeAt(index);
    this.validateAllLineStock(false);
  }

  removeServiceItem(index: number): void {
    this.serviceItems.removeAt(index);
  }

  removeItem(index: number): void {
    this.removePartItem(index);
  }

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  itemInvalid(array: FormArray, index: number, control: string): boolean {
    const c = array.at(index).get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  partItemInvalid(index: number, control: string): boolean {
    return this.itemInvalid(this.partItems, index, control);
  }

  serviceItemInvalid(index: number, control: string): boolean {
    return this.itemInvalid(this.serviceItems, index, control);
  }

  itemInvalidLegacy(index: number, control: string): boolean {
    return this.partItemInvalid(index, control);
  }

  lineLineAmount(array: FormArray, index: number, itemType: 'part' | 'service'): number {
    const row = array.at(index);
    const line = calculateLineAmounts(
      Number(row.get('quantity')?.value) || 0,
      Number(row.get('unitPrice')?.value) || 0,
      this.form.get('billingType')?.value ?? 'non-gst',
      this.form.get('gstType')?.value ?? undefined,
      this.effectiveGstPercent,
      itemType,
    );
    return line.amount;
  }

  private buildDraftItems(): InvoiceItem[] {
    const value = this.form.getRawValue();
    const parts: InvoiceItem[] = value.partItems
      .filter((item) => item.description?.trim())
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        partId: item.partId || undefined,
        itemType: 'part' as const,
      }));
    const services: InvoiceItem[] = value.serviceItems
      .filter((item) => item.description?.trim())
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: 'service' as const,
      }));
    return [...parts, ...services];
  }

  private invoiceAmounts() {
    return calculateInvoiceAmounts(
      this.buildDraftItems(),
      this.form.get('billingType')?.value ?? 'non-gst',
      this.form.get('gstType')?.value ?? undefined,
      this.effectiveGstPercent,
    );
  }

  get subtotal(): number {
    return this.invoiceAmounts().subtotal;
  }

  private get effectiveGstPercent(): number {
    return this.isGst ? Number(this.form.get('gstPercent')?.value) || 0 : 0;
  }

  get cgst(): number {
    return this.invoiceAmounts().cgst;
  }

  get sgst(): number {
    return this.invoiceAmounts().sgst;
  }

  get igst(): number {
    return this.invoiceAmounts().igst;
  }

  get taxTotal(): number {
    return this.invoiceAmounts().taxTotal;
  }

  get total(): number {
    return this.invoiceAmounts().total;
  }

  private pruneEmptyLineItems(): void {
    for (let i = this.partItems.length - 1; i >= 0; i--) {
      const desc = this.partItems.at(i).get('description')?.value?.trim();
      if (!desc) {
        this.partItems.removeAt(i);
      }
    }
    for (let i = this.serviceItems.length - 1; i >= 0; i--) {
      const desc = this.serviceItems.at(i).get('description')?.value?.trim();
      if (!desc) {
        this.serviceItems.removeAt(i);
      }
    }
  }

  async submit(): Promise<void> {
    this.pruneEmptyLineItems();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.validateAllLineStock(false);
    if (Object.keys(this.lineStockErrors()).length) {
      this.notify.error(Object.values(this.lineStockErrors())[0]);
      return;
    }
    this.submitting.set(true);
    const value = this.form.getRawValue();
    const customer = orEmpty(this.customers()).find((c) => c.id === value.customerId);
    const partRows: InvoiceItem[] = value.partItems
      .filter((item) => item.description?.trim())
      .map((item) =>
        normalizeInvoiceItem({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          partId: item.partId || undefined,
          itemType: 'part',
        }),
      );
    const serviceRows: InvoiceItem[] = value.serviceItems
      .filter((item) => item.description?.trim())
      .map((item) =>
        normalizeInvoiceItem({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemType: 'service',
        }),
      );
    const items: InvoiceItem[] = [...partRows, ...serviceRows];
    if (!items.length) {
      this.notify.error('Add at least one part or service line.');
      this.submitting.set(false);
      return;
    }
    const amounts = calculateInvoiceAmounts(
      items,
      value.billingType,
      this.isGst ? value.gstType : undefined,
      this.effectiveGstPercent,
    );
    const stockError = this.isEdit
      ? this.validateStockForEdit(this.originalItems(), items)
      : this.validateStock(items);
    if (stockError) {
      this.notify.error(stockError);
      this.submitting.set(false);
      return;
    }
    const payload = {
      invoiceNo: value.invoiceNo,
      customerId: value.customerId,
      customerName: customer?.name ?? '',
      jobCardId: this.linkedJobCardId() ?? undefined,
      items,
      billingType: value.billingType,
      gstType: this.isGst ? value.gstType : '',
      gstPercent: this.effectiveGstPercent,
      customerGstin: value.customerGstin ?? '',
      status: value.status,
      subtotal: amounts.subtotal,
      cgst: amounts.cgst,
      sgst: amounts.sgst,
      igst: amounts.igst,
      taxTotal: amounts.taxTotal,
      total: amounts.total,
    };
    try {
      if (this.isEdit && this.id) {
        await this.invoiceService.update(this.id, payload as never);
        await this.restoreInventory(this.originalItems(), value.invoiceNo);
        await this.deductInventory(items, value.invoiceNo);
        this.notify.success('Invoice updated.');
      } else {
        await this.invoiceService.create(payload as never);
        await this.deductInventory(items, value.invoiceNo);
        this.notify.success('Invoice created.');
      }
      await this.router.navigate(['/invoices']);
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }

  private validateStock(items: InvoiceItem[]): string | null {
    const required = this.aggregatePartQuantities(items);
    for (const { part, quantity } of required.values()) {
      if (part.quantity < quantity) {
        return `Not enough stock for "${part.name}". Available: ${part.quantity}, required: ${quantity}.`;
      }
    }
    return null;
  }

  private aggregatePartQuantities(
    items: InvoiceItem[],
  ): Map<string, { part: Part; quantity: number }> {
    const required = new Map<string, { part: Part; quantity: number }>();
    for (const item of items) {
      const part = this.resolvePart(item);
      if (!part?.id) {
        continue;
      }
      const existing = required.get(part.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        required.set(part.id, { part, quantity: item.quantity });
      }
    }
    return required;
  }

  private validateStockForEdit(oldItems: InvoiceItem[], newItems: InvoiceItem[]): string | null {
    const netOut = new Map<string, number>();

    for (const item of oldItems) {
      const part = this.resolvePart(item);
      if (part?.id) {
        netOut.set(part.id, (netOut.get(part.id) ?? 0) - item.quantity);
      }
    }
    for (const item of newItems) {
      const part = this.resolvePart(item);
      if (part?.id) {
        netOut.set(part.id, (netOut.get(part.id) ?? 0) + item.quantity);
      }
    }

    for (const [partId, delta] of netOut) {
      if (delta <= 0) {
        continue;
      }
      const part = orEmpty(this.parts()).find((p) => p.id === partId);
      if (part && part.quantity < delta) {
        return `Not enough stock for "${part.name}". Available: ${part.quantity}, need ${delta} more.`;
      }
    }
    return null;
  }

  private async deductInventory(items: InvoiceItem[], invoiceNo: string): Promise<void> {
    const performedBy = this.auth.user()?.name;
    for (const item of items) {
      const part = this.resolvePart(item);
      if (!part?.id) {
        continue;
      }
      await this.stockService.record(
        part,
        'out',
        item.quantity,
        `Sold on invoice ${invoiceNo}`,
        performedBy,
      );
    }
  }

  private async restoreInventory(items: InvoiceItem[], invoiceNo: string): Promise<void> {
    const performedBy = this.auth.user()?.name;
    for (const item of items) {
      const part = this.resolvePart(item);
      if (!part?.id) {
        continue;
      }
      await this.stockService.record(
        part,
        'in',
        item.quantity,
        `Restored from invoice ${invoiceNo} update`,
        performedBy,
      );
    }
  }
}
