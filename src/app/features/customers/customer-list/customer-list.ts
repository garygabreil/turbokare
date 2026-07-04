import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { JobCardService } from '../../../core/services/job-card.service';
import { FollowUpService } from '../../../core/services/follow-up.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Customer } from '../../../core/models';
import { Pagination } from '../../../shared/pagination/pagination';
import { ListSearch } from '../../../shared/list-search/list-search';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
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
import { rowNumber as calcRowNumber } from '../../../core/utils/date-filter';

export interface CustomerRow {
  customer: Customer;
  vehicleCount: number;
  jobCount: number;
  pendingFollowUps: number;
  lastVisit: number | null;
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    Pagination,
    ListSearch,
    PageLoading,
    FormKeyboardDirective,
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
  });

  readonly summary = computed(() => {
    const rows = this.rows();
    return {
      total: rows.length,
      vehicles: orEmpty(this.vehicles()).length,
      pendingFollowUps: orEmpty(this.followUps()).filter((f) => f.status === 'pending').length,
    };
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
    let items = searchByFields(this.rows(), this.search(), [
      (r) => r.customer.name,
      (r) => r.customer.phone,
      (r) => r.customer.email,
    ]);
    return sortItems(items, this.sort(), {
      name: (r) => r.customer.name ?? '',
      phone: (r) => r.customer.phone ?? '',
      vehicles: (r) => r.vehicleCount,
      jobs: (r) => r.jobCount,
      followUps: (r) => r.pendingFollowUps,
      lastVisit: (r) => r.lastVisit ?? 0,
    });
  });

  readonly paged = computed(() => paginateItems(this.filtered(), this.page(), this.pageSize));

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
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

  openAdd(): void {
    this.addForm.reset({
      name: '',
      phone: '',
      email: '',
      registrationNo: '',
      make: '',
      model: '',
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
        make: value.make,
        model: value.model,
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
