import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { InrCurrencyPipe } from '../../shared/pipes/inr-currency.pipe';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { JobCardService } from '../../core/services/job-card.service';
import { PartService } from '../../core/services/part.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { FollowUpService } from '../../core/services/follow-up.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DayFilter } from '../../shared/day-filter/day-filter';
import { ListSearch } from '../../shared/list-search/list-search';
import { Pagination } from '../../shared/pagination/pagination';
import { PageLoading } from '../../shared/page-loading/page-loading';
import { isDataLoading, loadSignal, orEmpty } from '../../core/utils/loading-signal';
import {
  applyDayFilter,
  DayFilterMode,
  rowNumber as calcRowNumber,
  todayDateInput,
} from '../../core/utils/date-filter';
import {
  paginateItems,
  searchByFields,
  sortIconClass,
  sortItems,
  SortState,
  toggleSort,
} from '../../core/utils/table-utils';
import {
  buildAllServiceReminders,
  reminderStatusClass,
  reminderStatusLabel,
} from '../../core/utils/service-reminder';
import { formatReminderSummary, syncServiceReminderFollowUps } from '../../core/utils/service-reminder-sync';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, InrCurrencyPipe, DecimalPipe, DayFilter, ListSearch, Pagination, PageLoading],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly customerService = inject(CustomerService);
  private readonly vehicleService = inject(VehicleService);
  private readonly jobCardService = inject(JobCardService);
  private readonly partService = inject(PartService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly followUpService = inject(FollowUpService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  private readonly customers = loadSignal(this.customerService.list());
  private readonly vehicles = loadSignal(this.vehicleService.list());
  private readonly jobCards = loadSignal(this.jobCardService.list());
  private readonly parts = loadSignal(this.partService.list());
  private readonly invoices = loadSignal(this.invoiceService.list());

  private readonly remindersSynced = signal(false);
  readonly syncingReminders = signal(false);

  readonly loading = isDataLoading(
    this.customers,
    this.vehicles,
    this.jobCards,
    this.parts,
    this.invoices,
  );

  readonly dayMode = signal<DayFilterMode>('today');
  readonly viewDate = signal(todayDateInput());
  readonly jobsSearch = signal('');
  readonly jobsSort = signal<SortState>({ key: 'createdAt', direction: 'desc' });
  readonly jobsPage = signal(1);
  readonly stockSearch = signal('');
  readonly stockSort = signal<SortState>({ key: 'quantity', direction: 'asc' });
  readonly stockPage = signal(1);
  readonly remindersSearch = signal('');
  readonly remindersPage = signal(1);
  readonly pageSize = 5;

  readonly reminderStatusClass = reminderStatusClass;
  readonly reminderStatusLabel = reminderStatusLabel;
  readonly formatReminderSummary = formatReminderSummary;

  constructor() {
    effect(() => {
      const vehicles = this.vehicles();
      const jobCards = this.jobCards();
      if (vehicles === undefined || jobCards === undefined || this.remindersSynced()) {
        return;
      }
      this.remindersSynced.set(true);
      void this.runReminderSync(false);
    });
  }

  readonly filteredJobs = computed(() =>
    applyDayFilter(orEmpty(this.jobCards()), (j) => j.createdAt, this.dayMode(), this.viewDate()),
  );

  readonly filteredInvoices = computed(() =>
    applyDayFilter(orEmpty(this.invoices()), (i) => i.createdAt, this.dayMode(), this.viewDate()),
  );

  readonly serviceReminders = computed(() =>
    buildAllServiceReminders(orEmpty(this.vehicles()), orEmpty(this.jobCards())),
  );

  readonly serviceReminderCount = computed(() => this.serviceReminders().length);

  readonly filteredReminders = computed(() => {
    return searchByFields(this.serviceReminders(), this.remindersSearch(), [
      (r) => r.registrationNo,
      (r) => r.customerName,
      (r) => r.vehicleLabel,
      (r) => r.fuelType,
      (r) => r.note,
    ]);
  });

  readonly pagedReminders = computed(() =>
    paginateItems(this.filteredReminders(), this.remindersPage(), this.pageSize),
  );

  readonly totalCustomers = computed(() => {
    if (this.dayMode() === 'all') {
      return orEmpty(this.customers()).length;
    }
    return this.filteredJobs().length
      ? new Set(this.filteredJobs().map((j) => j.customerId).filter(Boolean)).size
      : 0;
  });

  readonly totalVehicles = computed(() => {
    if (this.dayMode() === 'all') {
      return orEmpty(this.vehicles()).length;
    }
    return this.filteredJobs().length
      ? new Set(this.filteredJobs().map((j) => j.vehicleId).filter(Boolean)).size
      : 0;
  });

  readonly activeJobs = computed(
    () =>
      this.filteredJobs().filter((j) => j.status === 'pending' || j.status === 'in-progress').length,
  );

  readonly lowStock = computed(
    () => orEmpty(this.parts()).filter((p) => p.quantity <= p.reorderLevel).length,
  );

  readonly unpaidInvoices = computed(
    () => this.filteredInvoices().filter((i) => i.status !== 'paid').length,
  );

  readonly revenue = computed(() =>
    this.filteredInvoices()
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (i.total ?? 0), 0),
  );

  readonly jobsRows = computed(() => {
    let items = searchByFields(this.filteredJobs(), this.jobsSearch(), [
      (j) => j.vehicleLabel,
      (j) => j.customerName,
      (j) => j.complaint,
      (j) => j.status,
    ]);
    return sortItems(items, this.jobsSort(), {
      vehicle: (j) => j.vehicleLabel ?? '',
      customer: (j) => j.customerName ?? '',
      complaint: (j) => j.complaint ?? '',
      status: (j) => j.status ?? '',
      createdAt: (j) => j.createdAt ?? 0,
    });
  });

  readonly pagedJobs = computed(() => paginateItems(this.jobsRows(), this.jobsPage(), this.pageSize));

  readonly stockRows = computed(() => {
    let items = orEmpty(this.parts()).filter((p) => p.quantity <= p.reorderLevel);
    items = searchByFields(items, this.stockSearch(), [(p) => p.name, (p) => p.sku]);
    return sortItems(items, this.stockSort(), {
      name: (p) => p.name ?? '',
      quantity: (p) => p.quantity ?? 0,
    });
  });

  readonly pagedStock = computed(() =>
    paginateItems(this.stockRows(), this.stockPage(), this.pageSize),
  );

  async runReminderSync(showToast: boolean): Promise<void> {
    const vehicles = this.vehicles();
    const jobCards = this.jobCards();
    if (vehicles === undefined || jobCards === undefined) {
      return;
    }
    this.syncingReminders.set(true);
    try {
      const created = await syncServiceReminderFollowUps(
        this.followUpService,
        orEmpty(vehicles),
        orEmpty(jobCards),
        this.auth.user()?.name,
      );
      if (showToast) {
        this.notify.success(
          created > 0 ? `${created} service reminder(s) added to follow-ups.` : 'Reminders are up to date.',
        );
      }
    } catch (err) {
      if (showToast) {
        this.notify.error((err as Error).message);
      }
    } finally {
      this.syncingReminders.set(false);
    }
  }

  setJobsSort(key: string): void {
    this.jobsSort.update((s) => toggleSort(s, key));
    this.jobsPage.set(1);
  }

  setStockSort(key: string): void {
    this.stockSort.update((s) => toggleSort(s, key));
    this.stockPage.set(1);
  }

  jobsSortIcon(key: string): string {
    return sortIconClass(key, this.jobsSort());
  }

  stockSortIcon(key: string): string {
    return sortIconClass(key, this.stockSort());
  }

  jobsRowNumber(index: number): number {
    return calcRowNumber(this.jobsPage(), this.pageSize, index);
  }

  stockRowNumber(index: number): number {
    return calcRowNumber(this.stockPage(), this.pageSize, index);
  }

  remindersRowNumber(index: number): number {
    return calcRowNumber(this.remindersPage(), this.pageSize, index);
  }

  onJobsSearch(value: string): void {
    this.jobsSearch.set(value);
    this.jobsPage.set(1);
  }

  onStockSearch(value: string): void {
    this.stockSearch.set(value);
    this.stockPage.set(1);
  }

  onRemindersSearch(value: string): void {
    this.remindersSearch.set(value);
    this.remindersPage.set(1);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'text-bg-success';
      case 'in-progress':
        return 'text-bg-primary';
      case 'delivered':
        return 'text-bg-secondary';
      default:
        return 'text-bg-warning';
    }
  }
}
