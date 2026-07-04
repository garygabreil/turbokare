import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JobCardService } from '../../../core/services/job-card.service';
import { NotificationService } from '../../../core/services/notification.service';
import { JobStatus } from '../../../core/models';

@Component({
  selector: 'app-job-card-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './job-card-list.html',
})
export class JobCardList {
  private readonly jobCardService = inject(JobCardService);
  private readonly notify = inject(NotificationService);

  private readonly jobs = toSignal(this.jobCardService.list(), { initialValue: [] });
  readonly statusFilter = signal<'all' | JobStatus>('all');

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    if (status === 'all') {
      return this.jobs();
    }
    return this.jobs().filter((j) => j.status === status);
  });

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
