import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Customer, Invoice, JobCard, Vehicle } from '../models';
import { CustomerService } from './customer.service';
import { JobCardService } from './job-card.service';
import { VehicleService } from './vehicle.service';

export interface InvoicePrintContext {
  customer: Customer | null;
  jobCard: JobCard | null;
  vehicle: Vehicle | null;
}

@Injectable({ providedIn: 'root' })
export class InvoicePrintContextService {
  private readonly customerService = inject(CustomerService);
  private readonly jobCardService = inject(JobCardService);
  private readonly vehicleService = inject(VehicleService);

  async load(invoice: Invoice): Promise<InvoicePrintContext> {
    let customer: Customer | null = null;
    if (invoice.customerId) {
      customer = (await firstValueFrom(this.customerService.get(invoice.customerId))) ?? null;
    }

    let jobCard: JobCard | null = null;
    if (invoice.jobCardId) {
      jobCard = (await firstValueFrom(this.jobCardService.get(invoice.jobCardId))) ?? null;
    }
    if (!jobCard && invoice.customerId) {
      jobCard = await this.findLatestJobCardForCustomer(invoice.customerId);
    }

    let vehicle: Vehicle | null = null;
    const vehicleId = jobCard?.vehicleId;
    if (vehicleId) {
      vehicle = (await firstValueFrom(this.vehicleService.get(vehicleId))) ?? null;
    }
    if (!vehicle && invoice.customerId) {
      vehicle = await this.findPrimaryVehicleForCustomer(invoice.customerId);
    }

    return { customer, jobCard, vehicle };
  }

  private async findLatestJobCardForCustomer(customerId: string): Promise<JobCard | null> {
    const jobs = await firstValueFrom(this.jobCardService.list());
    return (
      [...jobs]
        .filter((j) => j.customerId === customerId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null
    );
  }

  private async findPrimaryVehicleForCustomer(customerId: string): Promise<Vehicle | null> {
    const vehicles = await firstValueFrom(this.vehicleService.list());
    return (
      [...vehicles]
        .filter((v) => v.customerId === customerId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null
    );
  }
}
