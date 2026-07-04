import { Component, computed, inject, signal } from '@angular/core';
import { InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JobCardService } from '../../../core/services/job-card.service';
import { NotificationService } from '../../../core/services/notification.service';
import { JobStatus } from '../../../core/models';
import { Pagination } from '../../../shared/pagination/pagination';
import { DayFilter } from '../../../shared/day-filter/day-filter';
import { ListSearch } from '../../../shared/list-search/list-search';
import { PageLoading } from '../../../shared/page-loading/page-loading';
import { isDataLoading, loadSignal, orEmpty } from '../../../core/utils/loading-signal';
import {
  applyDayFilter,
  DayFilterMode,
  rowNumber as calcRowNumber,
  todayDateInput,
} from '../../../core/utils/date-filter';
import {
  paginateItems,
  searchByFields,
  sortIconClass,
  sortItems,
  SortState,
  toggleSort,
} from '../../../core/utils/table-utils';

@Component({
  selector: 'app-job-card-list',
  standalone: true,
  imports: [RouterLink, FormsModule, InrCurrencyPipe, Pagination, DayFilter, ListSearch, PageLoading],
  templateUrl: './job-card-list.html',
})
export class JobCardList {
  private readonly jobCardService = inject(JobCardService);
  private readonly notify = inject(NotificationService);

  private readonly jobs = loadSignal(this.jobCardService.list());
  readonly loading = isDataLoading(this.jobs);
  readonly statusFilter = signal<'all' | JobStatus>('all');
  readonly dayMode = signal<DayFilterMode>('today');
  readonly viewDate = signal(todayDateInput());
  readonly search = signal('');
  readonly sort = signal<SortState>({ key: 'createdAt', direction: 'desc' });
  readonly pageSize = 8;
  readonly page = signal(1);

  readonly dayFiltered = computed(() =>
    applyDayFilter(orEmpty(this.jobs()), (j) => j.createdAt, this.dayMode(), this.viewDate()),
  );

  readonly summary = computed(() => {
    const items = this.dayFiltered();
    return {
      total: items.length,
      active: items.filter((j) => j.status === 'pending' || j.status === 'in-progress').length,
      completed: items.filter((j) => j.status === 'completed' || j.status === 'delivered').length,
      estimated: items.reduce((sum, j) => sum + (j.estimatedCost ?? 0), 0),
    };
  });

  readonly filtered = computed(() => {
    let items = this.dayFiltered();
    const status = this.statusFilter();
    if (status !== 'all') {
      items = items.filter((j) => j.status === status);
    }
    items = searchByFields(items, this.search(), [
      (j) => j.vehicleLabel,
      (j) => j.customerName,
      (j) => j.complaint,
      (j) => j.status,
    ]);
    return sortItems(items, this.sort(), {
      vehicle: (j) => j.vehicleLabel ?? '',
      customer: (j) => j.customerName ?? '',
      complaint: (j) => j.complaint ?? '',
      cost: (j) => j.estimatedCost ?? 0,
      status: (j) => j.status ?? '',
      createdAt: (j) => j.createdAt ?? 0,
    });
  });

  readonly paged = computed(() => paginateItems(this.filtered(), this.page(), this.pageSize));

  setFilter(status: 'all' | JobStatus): void {
    this.statusFilter.set(status);
    this.page.set(1);
  }

  onDayFilterChange(): void {
    this.page.set(1);
  }

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

  vehicleDisplay(label?: string): string {
    return (label ?? '').replace(/\s*•\s*/g, ' ').trim() || '—';
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

  async updateStatus(id: string | undefined, status: JobStatus): Promise<void> {
    if (!id) {
      return;
    }
    try {
      await this.jobCardService.update(id, { status });
      this.notify.success('Status updated.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }

  async remove(id: string | undefined): Promise<void> {
    if (!id) {
      return;
    }
    if (!confirm('Delete this job card?')) {
      return;
    }
    try {
      await this.jobCardService.remove(id);
      this.notify.success('Job card deleted.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }
}
