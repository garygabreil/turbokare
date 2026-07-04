import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartService } from '../../../core/services/part.service';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Part, StockMovementType } from '../../../core/models';

@Component({
  selector: 'app-part-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './part-list.html',
})
export class PartList {
  private readonly partService = inject(PartService);
  private readonly stockService = inject(StockMovementService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  private readonly parts = toSignal(this.partService.list(), { initialValue: [] });
  readonly search = signal('');

  // Stock adjustment modal state
  readonly selectedPart = signal<Part | null>(null);
  readonly adjustType = signal<StockMovementType>('in');
  readonly adjustQty = signal<number>(1);
  readonly adjustReason = signal<string>('');
  readonly saving = signal(false);

  readonly totalValue = computed(() =>
    this.parts().reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
  );

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.parts();
    }
    return this.parts().filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.category ?? '').toLowerCase().includes(term),
    );
  });

  isLow(quantity: number, reorder: number): boolean {
    return quantity <= reorder;
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
