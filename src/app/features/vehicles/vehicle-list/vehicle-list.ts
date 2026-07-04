import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VehicleService } from '../../../core/services/vehicle.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './vehicle-list.html',
})
export class VehicleList {
  private readonly vehicleService = inject(VehicleService);
  private readonly notify = inject(NotificationService);

  private readonly vehicles = toSignal(this.vehicleService.list(), { initialValue: [] });
  readonly search = signal('');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.vehicles();
    }
    return this.vehicles().filter(
      (v) =>
        v.registrationNo.toLowerCase().includes(term) ||
        v.make.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term) ||
        (v.customerName ?? '').toLowerCase().includes(term),
    );
  });

  async remove(id: string | undefined, label: string): Promise<void> {
    if (!id) {
      return;
    }
    if (!confirm(`Delete vehicle "${label}"?`)) {
      return;
    }
    try {
      await this.vehicleService.remove(id);
      this.notify.success('Vehicle deleted.');
    } catch (err) {
      this.notify.error((err as Error).message);
    }
  }
}
