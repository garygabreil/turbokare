import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { resolveVehicleMakeModel } from '../../../core/constants/indian-vehicles';
import { VehicleService } from '../../../core/services/vehicle.service';
import { JobCardService } from '../../../core/services/job-card.service';
import { FollowUpService } from '../../../core/services/follow-up.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { Customer } from '../../../core/models';
import { Pagination } from '../../../shared/pagination/pagination';
import { DayFilter } from '../../../shared/day-filter/day-filter';
import { ListSearch } from '../../../shared/list-search/list-search';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
import { VehicleMakeModel } from '../../../shared/vehicle-make-model/vehicle-make-model';
import { isDataLoading, loadSignal, orEmpty } from '../../../core/utils/loading-signal';
import { vehiclesForCustomer } from '../../../core/utils/customer-vehicles';
import {
  paginateItems,
  searchByFields,
  sortIconClass,
  sortItems,
  SortState,
  toggleSort,
} from '../../../core/utils/table-utils';
import {
  DayFilterMode,
  isInDateRange,
  isSameDay,
  rowNumber as calcRowNumber,
  todayDateInput,
  toDateInput,
} from '../../../core/utils/date-filter';
import {
  CUSTOMER_CSV_COLUMNS,
  customerExportRows,
  customerListExportFilename,
} from '../../../core/utils/customer-export';

export interface CustomerRow {
  customer: Customer;
  vehicleCount: number;
  jobCount: number;
  pendingFollowUps: number;
  lastVisit: number | null;
}

export type CustomerSegment = 'all' | 'active' | 'follow-up' | 'inactive' | 'repeat';
export type CustomerDateField = 'registered' | 'lastVisit';

const MS_PER_DAY = 86_400_000;

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    Pagination,
    DayFilter,
    ListSearch,
    PageLoading,
    FormKeyboardDirective,
    VehicleMakeModel,
  ],
  templateUrl: './customer-list.html',
})
export class CustomerList {
  private readonly fb = inject(FormBuilder);
  private readonly customerService = inject(CustomerService);
  private readonly vehicleService = inject(VehicleService);
  private readonly jobCardService = inject(JobCardService);
  private readonly followUpService = inject(FollowUpService);
  private readonly notify = inject(NotificationService);
  private readonly exporter = inject(ExportService);

  private readonly customers = loadSignal(this.customerService.list());
  private readonly vehicles = loadSignal(this.vehicleService.list());
  private readonly jobCards = loadSignal(this.jobCardService.list());
  private readonly followUps = loadSignal(this.followUpService.list());

  readonly loading = isDataLoading(
    this.customers,
    this.vehicles,
    this.jobCards,
    this.followUps,
  );

  readonly search = signal('');
  readonly sort = signal<SortState>({ key: 'name', direction: 'asc' });
  readonly dayMode = signal<DayFilterMode>('all');
  readonly viewDate = signal(todayDateInput());
  readonly dateField = signal<CustomerDateField>('registered');
  readonly segment = signal<CustomerSegment>('all');
  readonly pageSize = 8;
  readonly page = signal(1);
  readonly showAddModal = signal(false);
  readonly saving = signal(false);

  readonly addForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    email: ['', [Validators.email]],
    registrationNo: ['', [Validators.required]],
    make: [''],
    model: [''],
    makeCustom: [''],
    modelCustom: [''],
    year: [null as number | null],
  });

  readonly dayFiltered = computed(() => {
    const field = this.dateField();
    return this.rows().filter((row) => this.matchesDayFilter(row, field));
  });

  readonly segmentFiltered = computed(() => {
    const items = this.dayFiltered();
    const seg = this.segment();
    if (seg === 'all') {
      return items;
    }
    const now = Date.now();
    return items.filter((row) => {
      switch (seg) {
        case 'active':
          return row.lastVisit !== null && now - row.lastVisit <= 90 * MS_PER_DAY;
        case 'follow-up':
          return row.pendingFollowUps > 0;
        case 'inactive':
          return row.lastVisit === null || now - row.lastVisit > 180 * MS_PER_DAY;
        case 'repeat':
          return row.jobCount >= 2;
        default:
          return true;
      }
    });
  });

  readonly summary = computed(() => {
    const items = this.segmentFiltered();
    const now = Date.now();
    const totalJobs = items.reduce((sum, row) => sum + row.jobCount, 0);
    return {
      total: items.length,
      vehicles: items.reduce((sum, row) => sum + row.vehicleCount, 0),
      pendingFollowUps: items.reduce((sum, row) => sum + row.pendingFollowUps, 0),
      active: items.filter(
        (row) => row.lastVisit !== null && now - row.lastVisit <= 90 * MS_PER_DAY,
      ).length,
      repeat: items.filter((row) => row.jobCount >= 2).length,
      noVisit: items.filter((row) => row.jobCount === 0).length,
      avgJobs: items.length ? (totalJobs / items.length).toFixed(1) : '0',
      newThisMonth: items.filter((row) =>
        isInDateRange(row.customer.createdAt, this.monthStart(), todayDateInput()),
      ).length,
    };
  });

  readonly topCustomers = computed(() =>
    [...this.segmentFiltered()]
      .filter((row) => row.jobCount > 0)
      .sort((a, b) => b.jobCount - a.jobCount || a.customer.name.localeCompare(b.customer.name))
      .slice(0, 5),
  );

  readonly periodLabel = computed(() => {
    const mode = this.dayMode();
    if (mode === 'all') {
      return 'all time';
    }
    if (mode === 'today') {
      return 'today';
    }
    const field = this.dateField() === 'registered' ? 'registered' : 'visited';
    return `${field} on ${this.formatDisplayDate(this.viewDate())}`;
  });

  readonly rows = computed<CustomerRow[]>(() => {
    const vehicles = orEmpty(this.vehicles());
    const jobs = orEmpty(this.jobCards());
    const followUps = orEmpty(this.followUps());

    return orEmpty(this.customers()).map((customer) => {
      const id = customer.id ?? '';
      const customerJobs = jobs.filter((j) => j.customerId === id);
      const customerVehicles = vehiclesForCustomer(
        id,
        customer.name,
        vehicles,
        customerJobs,
      );
      const pendingFollowUps = followUps.filter(
        (f) => f.customerId === id && f.status === 'pending',
      ).length;
      const lastVisit = customerJobs.reduce<number | null>((max, j) => {
        const ts = j.createdAt ?? 0;
        return max === null || ts > max ? ts : max;
      }, null);

      return {
        customer,
        vehicleCount: customerVehicles.length,
        jobCount: customerJobs.length,
        pendingFollowUps,
        lastVisit,
      };
    });
  });

  readonly filtered = computed(() => {
    let items = this.segmentFiltered();
    items = searchByFields(items, this.search(), [
      (r) => r.customer.name,
      (r) => r.customer.phone,
      (r) => r.customer.email,
      (r) => r.customer.createdAt ? toDateInput(new Date(r.customer.createdAt)) : '',
      (r) => r.lastVisit ? toDateInput(new Date(r.lastVisit)) : '',
    ]);
    return sortItems(items, this.sort(), {
      name: (r) => r.customer.name ?? '',
      phone: (r) => r.customer.phone ?? '',
      vehicles: (r) => r.vehicleCount,
      jobs: (r) => r.jobCount,
      followUps: (r) => r.pendingFollowUps,
      registered: (r) => r.customer.createdAt ?? 0,
      lastVisit: (r) => r.lastVisit ?? 0,
    });
  });

  readonly paged = computed(() => paginateItems(this.filtered(), this.page(), this.pageSize));

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  onDayFilterChange(): void {
    this.page.set(1);
  }

  setDateField(field: CustomerDateField): void {
    this.dateField.set(field);
    this.page.set(1);
  }

  setSegment(value: CustomerSegment): void {
    this.segment.set(value);
    this.page.set(1);
  }

  segmentLabel(value: CustomerSegment): string {
    const labels: Record<CustomerSegment, string> = {
      all: 'All',
      active: 'Active (90d)',
      'follow-up': 'Follow-ups',
      inactive: 'Inactive',
      repeat: 'Repeat',
    };
    return labels[value];
  }

  private monthStart(): string {
    const d = new Date();
    return toDateInput(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  private formatDisplayDate(dateStr: string): string {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private matchesDayFilter(row: CustomerRow, field: CustomerDateField): boolean {
    const mode = this.dayMode();
    if (mode === 'all') {
      return true;
    }
    const ts = field === 'registered' ? row.customer.createdAt : row.lastVisit ?? undefined;
    if (field === 'lastVisit' && !ts) {
      return false;
    }
    const dateStr = mode === 'today' ? todayDateInput() : this.viewDate();
    return isSameDay(ts, dateStr);
  }

  setSort(key: string): void {
    this.sort.update((s) => toggleSort(s, key));
    this.page.set(1);
  }

  sortIcon(key: string): string {
    return sortIconClass(key, this.sort());
  }

  rowNumber(index: number): number {
    return calcRowNumber(this.page(), this.pageSize, index);
  }

  exportCsv(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.notify.info('No customers to export for the current filters.');
      return;
    }
    this.exporter.toCsv(
      customerExportRows(rows),
      CUSTOMER_CSV_COLUMNS,
      customerListExportFilename(this.dayMode(), this.viewDate(), this.segment()),
    );
    this.notify.success(`Exported ${rows.length} customer(s) to CSV.`);
  }

  openAdd(): void {
    this.addForm.reset({
      name: '',
      phone: '',
      email: '',
      registrationNo: '',
      make: '',
      model: '',
      makeCustom: '',
      modelCustom: '',
      year: null,
    });
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    this.showAddModal.set(false);
  }

  invalid(control: string): boolean {
    const c = this.addForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    input.value = digits;
    this.addForm.get('phone')?.setValue(digits);
  }

  async saveCustomer(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.addForm.getRawValue();
    const { make, model } = resolveVehicleMakeModel(value);
    try {
      const customerRef = (await this.customerService.create({
        name: value.name,
        phone: value.phone,
        email: value.email || undefined,
      } as never)) as { id: string };

      await this.vehicleService.create({
        customerId: customerRef.id,
        customerName: value.name,
        registrationNo: value.registrationNo,
        make,
        model,
        year: value.year,
      } as never);

      this.notify.success('Customer added.');
      this.closeAdd();
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
