import { Component, computed, inject, signal } from '@angular/core';
import { InrCurrencyPipe } from '../../../shared/pipes/inr-currency.pipe';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartService } from '../../../core/services/part.service';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Part, StockMovementType } from '../../../core/models';
import { Pagination } from '../../../shared/pagination/pagination';
import { DayFilter } from '../../../shared/day-filter/day-filter';
import { ListSearch } from '../../../shared/list-search/list-search';
import { FormKeyboardDirective } from '../../../shared/directives/form-keyboard.directive';
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
  selector: 'app-part-list',
  standalone: true,
  imports: [RouterLink, FormsModule, InrCurrencyPipe, Pagination, DayFilter, ListSearch, FormKeyboardDirective, PageLoading],
  templateUrl: './part-list.html',
  styleUrl: './part-list.scss',
})
export class PartList {
  readonly pageSize = 8;
  readonly page = signal(1);
  private readonly partService = inject(PartService);
  private readonly stockService = inject(StockMovementService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  private readonly parts = loadSignal(this.partService.list());
  readonly loading = isDataLoading(this.parts);
  readonly search = signal('');
  readonly sort = signal<SortState>({ key: 'name', direction: 'asc' });
  readonly dayMode = signal<DayFilterMode>('all');
  readonly viewDate = signal(todayDateInput());

  // Stock adjustment modal state
  readonly selectedPart = signal<Part | null>(null);
  readonly adjustType = signal<StockMovementType>('in');
  readonly adjustQty = signal<number>(1);
  readonly adjustReason = signal<string>('');
  readonly saving = signal(false);

  readonly lowStockThreshold = 5;

  readonly totalValue = computed(() =>
    orEmpty(this.parts()).reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
  );

  readonly lowStockParts = computed(() =>
    orEmpty(this.parts()).filter((p) => p.quantity < this.lowStockThreshold),
  );

  readonly totalParts = computed(() => orEmpty(this.parts()).length);

  readonly filtered = computed(() => {
    let items = applyDayFilter(
      orEmpty(this.parts()),
      (p) => p.createdAt,
      this.dayMode(),
      this.viewDate(),
    );
    items = searchByFields(items, this.search(), [
      (p) => p.name,
      (p) => p.sku,
      (p) => p.category,
    ]);
    return sortItems(items, this.sort(), {
      name: (p) => p.name ?? '',
      sku: (p) => p.sku ?? '',
      category: (p) => p.category ?? '',
      price: (p) => p.unitPrice ?? 0,
      quantity: (p) => p.quantity ?? 0,
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

  onDayFilterChange(): void {
    this.page.set(1);
  }

  rowNumber(index: number): number {
    return calcRowNumber(this.page(), this.pageSize, index);
  }

  isLow(quantity: number): boolean {
    return quantity < this.lowStockThreshold;
  }

  openAdjust(part: Part, type: StockMovementType): void {
    this.selectedPart.set(part);
    this.adjustType.set(type);
    this.adjustQty.set(type === 'adjust' ? part.quantity : 1);
    this.adjustReason.set('');
  }

  closeAdjust(): void {
    this.selectedPart.set(null);
  }

  async submitAdjust(): Promise<void> {
    const part = this.selectedPart();
    const qty = Number(this.adjustQty());
    if (!part) {
      return;
    }
    if (isNaN(qty) || qty < 0 || (this.adjustType() !== 'adjust' && qty <= 0)) {
      this.notify.warning('Enter a valid quantity.');
      return;
    }

    this.saving.set(true);
    try {
      const balance = await this.stockService.record(
        part,
        this.adjustType(),
        qty,
        this.adjustReason(),
        this.auth.user()?.name,
      );
      this.notify.success(`Stock updated. New balance: ${balance}.`);
      this.closeAdjust();
    } catch (err) {
      this.notify.error((err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: string | undefined, name: string): Promise<void> {
    if (!id) {
      return;
    }
    if (!confirm(`Delete part "${name}"?`)) {
      return;
    }
    try {
      await this.partService.remove(id);
      this.notify.success('Part deleted.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }
}
