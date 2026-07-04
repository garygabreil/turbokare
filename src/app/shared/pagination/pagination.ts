import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (total() > 0) {
      <nav class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
        <span class="list-pagination-info">
          Showing {{ startItem() }}–{{ endItem() }} of {{ total() }}
        </span>
        <ul class="pagination pagination-sm mb-0 list-pagination">
          <li class="page-item" [class.disabled]="page() === 1">
            <button type="button" class="page-link" (click)="go(page() - 1)" aria-label="Previous">
              <i class="bi bi-chevron-left"></i>
            </button>
          </li>

          @if (pages()[0] > 1) {
            <li class="page-item">
              <button type="button" class="page-link" (click)="go(1)">1</button>
            </li>
            <li class="page-item disabled"><span class="page-link">…</span></li>
          }

          @for (p of pages(); track p) {
            <li class="page-item" [class.active]="p === page()">
              <button type="button" class="page-link" (click)="go(p)">{{ p }}</button>
            </li>
          }

          @if (pages()[pages().length - 1] < totalPages()) {
            <li class="page-item disabled"><span class="page-link">…</span></li>
            <li class="page-item">
              <button type="button" class="page-link" (click)="go(totalPages())">
                {{ totalPages() }}
              </button>
            </li>
          }

          <li class="page-item" [class.disabled]="page() === totalPages()">
            <button type="button" class="page-link" (click)="go(page() + 1)" aria-label="Next">
              <i class="bi bi-chevron-right"></i>
            </button>
          </li>
        </ul>
      </nav>
    }
  `,
})
export class Pagination {
  readonly total = input.required<number>();
  readonly pageSize = input<number>(8);
  readonly page = input.required<number>();
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly pages = computed(() => {
    const totalPages = this.totalPages();
    const current = Math.min(this.page(), totalPages);
    const delta = 2;
    const start = Math.max(1, current - delta);
    const end = Math.min(totalPages, current + delta);
    const result: number[] = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  });

  readonly startItem = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly endItem = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  go(target: number): void {
    if (target >= 1 && target <= this.totalPages() && target !== this.page()) {
      this.pageChange.emit(target);
    }
  }
}
