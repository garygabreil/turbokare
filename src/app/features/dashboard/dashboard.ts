import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { JobCardService } from '../../core/services/job-card.service';
import { PartService } from '../../core/services/part.service';
import { InvoiceService } from '../../core/services/invoice.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly customerService = inject(CustomerService);
  private readonly vehicleService = inject(VehicleService);
  private readonly jobCardService = inject(JobCardService);
  private readonly partService = inject(PartService);
  private readonly invoiceService = inject(InvoiceService);

  private readonly customers = toSignal(this.customerService.list(), { initialValue: [] });
  private readonly vehicles = toSignal(this.vehicleService.list(), { initialValue: [] });
  private readonly jobCards = toSignal(this.jobCardService.list(), { initialValue: [] });
  private readonly parts = toSignal(this.partService.list(), { initialValue: [] });
  private readonly invoices = toSignal(this.invoiceService.list(), { initialValue: [] });

  readonly totalCustomers = computed(() => this.customers().length);
  readonly totalVehicles = computed(() => this.vehicles().length);

  readonly activeJobs = computed(
    () => this.jobCards().filter((j) => j.status === 'pending' || j.status === 'in-progress').length,
  );

  readonly lowStock = computed(
    () => this.parts().filter((p) => p.quantity <= p.reorderLevel).length,
  );

  readonly unpaidInvoices = computed(
    () => this.invoices().filter((i) => i.status !== 'paid').length,
  );

  readonly revenue = computed(() =>
    this.invoices()
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (i.total ?? 0), 0),
  );

  readonly recentJobs = computed(() => this.jobCards().slice(0, 5));

  readonly lowStockItems = computed(() =>
    this.parts().filter((p) => p.quantity <= p.reorderLevel).slice(0, 5),
  );

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
