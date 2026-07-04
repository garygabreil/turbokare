import { JobCard, Vehicle } from '../models';

/** Resolve all vehicles belonging to a customer (direct link, jobs, name fallback). */
export function vehiclesForCustomer(
  customerId: string,
  customerName: string | undefined,
  allVehicles: Vehicle[],
  customerJobs: JobCard[],
): Vehicle[] {
  const byId = new Map<string, Vehicle>();

  for (const vehicle of allVehicles) {
    if (vehicle.id && vehicle.customerId === customerId) {
      byId.set(vehicle.id, vehicle);
    }
  }

  for (const job of customerJobs) {
    if (!job.vehicleId) {
      continue;
    }
    if (byId.has(job.vehicleId)) {
      continue;
    }

    const linked = allVehicles.find((v) => v.id === job.vehicleId);
    if (linked) {
      byId.set(linked.id!, { ...linked, customerId });
      continue;
    }

    byId.set(job.vehicleId, vehicleFromJob(job, customerId));
  }

  const nameKey = customerName?.trim().toLowerCase();
  if (nameKey) {
    for (const vehicle of allVehicles) {
      if (!vehicle.id || byId.has(vehicle.id)) {
        continue;
      }
      if ((vehicle.customerName ?? '').trim().toLowerCase() === nameKey) {
        byId.set(vehicle.id, { ...vehicle, customerId });
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    (a.registrationNo ?? '').localeCompare(b.registrationNo ?? ''),
  );
}

function vehicleFromJob(job: JobCard, customerId: string): Vehicle {
  const label = (job.vehicleLabel ?? '').trim();
  const parts = label.split(/\s+/).filter(Boolean);
  const registrationNo = parts.length ? parts[parts.length - 1] : label || '—';

  return {
    id: job.vehicleId,
    customerId,
    customerName: job.customerName,
    registrationNo,
    make: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
    model: '',
  };
}
