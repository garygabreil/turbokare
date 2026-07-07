import { CustomerFollowUp, JobCard, Vehicle } from '../models';
import { FUEL_TYPES, FuelType } from '../constants/indian-vehicles';

/** Service interval in km by fuel type — edit for your workshop policy. */
export const SERVICE_INTERVAL_KM: Record<string, number> = {
  Petrol: 8000,
  Diesel: 10000,
  CNG: 8000,
  Electric: 15000,
  Hybrid: 10000,
  LPG: 8000,
};

export const DEFAULT_SERVICE_INTERVAL_KM = 8000;

/** Warn customer & staff when remaining km falls below this. */
export const SERVICE_REMINDER_WARN_KM = 500;

export type ServiceReminderStatus = 'unknown' | 'ok' | 'due_soon' | 'overdue';

export interface ServiceReminder {
  vehicleId: string;
  customerId: string;
  customerName: string;
  vehicleLabel: string;
  registrationNo: string;
  fuelType: string;
  intervalKm: number;
  currentOdometer: number;
  lastServiceOdometer: number | null;
  nextServiceOdometer: number;
  kmRemaining: number;
  status: ServiceReminderStatus;
  note: string;
}

const COMPLETED_JOB_STATUSES = new Set(['completed', 'delivered']);

export function serviceIntervalKm(fuelType?: string | null): number {
  const key = fuelType?.trim();
  if (key && key in SERVICE_INTERVAL_KM) {
    return SERVICE_INTERVAL_KM[key];
  }
  return DEFAULT_SERVICE_INTERVAL_KM;
}

export function lastServiceOdometerForVehicle(
  vehicle: Vehicle,
  jobCards: JobCard[],
): number | null {
  if (vehicle.lastServiceOdometer != null && vehicle.lastServiceOdometer > 0) {
    return vehicle.lastServiceOdometer;
  }

  const vehicleId = vehicle.id;
  if (!vehicleId) {
    return null;
  }

  let last: number | null = null;
  for (const job of jobCards) {
    if (job.vehicleId !== vehicleId || !COMPLETED_JOB_STATUSES.has(job.status)) {
      continue;
    }
    const km = job.odometer;
    if (km == null || km <= 0) {
      continue;
    }
    if (last == null || km > last) {
      last = km;
    }
  }
  return last;
}

export function nextServiceOdometer(
  lastServiceKm: number | null,
  currentKm: number,
  intervalKm: number,
): number {
  if (intervalKm <= 0) {
    return currentKm;
  }
  if (lastServiceKm != null && lastServiceKm > 0) {
    return lastServiceKm + intervalKm;
  }
  if (currentKm <= 0) {
    return intervalKm;
  }
  return Math.ceil(currentKm / intervalKm) * intervalKm;
}

export function serviceReminderStatus(
  currentKm: number,
  nextServiceKm: number,
  warnKm = SERVICE_REMINDER_WARN_KM,
): ServiceReminderStatus {
  if (currentKm <= 0 || nextServiceKm <= 0) {
    return 'unknown';
  }
  const remaining = nextServiceKm - currentKm;
  if (remaining < 0) {
    return 'overdue';
  }
  if (remaining <= warnKm) {
    return 'due_soon';
  }
  return 'ok';
}

export function vehicleLabel(vehicle: Vehicle): string {
  const parts = [vehicle.make, vehicle.model, vehicle.registrationNo].filter(Boolean);
  return parts.join(' ').trim() || vehicle.registrationNo || 'Vehicle';
}

export function buildServiceReminder(vehicle: Vehicle, jobCards: JobCard[]): ServiceReminder | null {
  const currentKm = vehicle.odometer ?? 0;
  if (currentKm <= 0) {
    return null;
  }

  const fuelType = vehicle.fuelType?.trim() || '';
  const intervalKm = serviceIntervalKm(fuelType);
  const lastServiceKm = lastServiceOdometerForVehicle(vehicle, jobCards);
  const nextServiceKm = nextServiceOdometer(lastServiceKm, currentKm, intervalKm);
  const kmRemaining = nextServiceKm - currentKm;
  const status = serviceReminderStatus(currentKm, nextServiceKm);

  const fuelLabel = fuelType || 'Petrol (default)';
  const note = buildServiceReminderNote(
    vehicle.registrationNo,
    currentKm,
    nextServiceKm,
    kmRemaining,
    fuelLabel,
    intervalKm,
    status,
  );

  return {
    vehicleId: vehicle.id ?? '',
    customerId: vehicle.customerId,
    customerName: vehicle.customerName ?? '',
    vehicleLabel: vehicleLabel(vehicle),
    registrationNo: vehicle.registrationNo,
    fuelType: fuelLabel,
    intervalKm,
    currentOdometer: currentKm,
    lastServiceOdometer: lastServiceKm,
    nextServiceOdometer: nextServiceKm,
    kmRemaining,
    status,
    note,
  };
}

export function buildServiceReminderNote(
  registrationNo: string,
  currentKm: number,
  nextServiceKm: number,
  kmRemaining: number,
  fuelType: string,
  intervalKm: number,
  status: ServiceReminderStatus,
): string {
  const reg = registrationNo.toUpperCase();
  if (status === 'overdue') {
    const overdueBy = Math.abs(kmRemaining);
    return `Service overdue: ${reg} — ${currentKm.toLocaleString('en-IN')} km (${overdueBy.toLocaleString('en-IN')} km past due at ${nextServiceKm.toLocaleString('en-IN')} km). ${fuelType}, every ${intervalKm.toLocaleString('en-IN')} km.`;
  }
  if (status === 'due_soon') {
    return `Service due soon: ${reg} — ${currentKm.toLocaleString('en-IN')} km, ${kmRemaining.toLocaleString('en-IN')} km left (due at ${nextServiceKm.toLocaleString('en-IN')} km). ${fuelType}, every ${intervalKm.toLocaleString('en-IN')} km.`;
  }
  return `Next service: ${reg} — due at ${nextServiceKm.toLocaleString('en-IN')} km (${kmRemaining.toLocaleString('en-IN')} km remaining). ${fuelType}, every ${intervalKm.toLocaleString('en-IN')} km.`;
}

export function buildAllServiceReminders(
  vehicles: Vehicle[],
  jobCards: JobCard[],
  options?: { includeOk?: boolean },
): ServiceReminder[] {
  const includeOk = options?.includeOk ?? false;
  const reminders: ServiceReminder[] = [];

  for (const vehicle of vehicles) {
    const reminder = buildServiceReminder(vehicle, jobCards);
    if (!reminder) {
      continue;
    }
    if (includeOk || reminder.status === 'due_soon' || reminder.status === 'overdue') {
      reminders.push(reminder);
    }
  }

  return reminders.sort((a, b) => {
    const rank = (s: ServiceReminderStatus) =>
      s === 'overdue' ? 0 : s === 'due_soon' ? 1 : s === 'ok' ? 2 : 3;
    const diff = rank(a.status) - rank(b.status);
    if (diff !== 0) {
      return diff;
    }
    return a.kmRemaining - b.kmRemaining;
  });
}

export function serviceReminderForVehicle(
  vehicleId: string | undefined,
  vehicles: Vehicle[],
  jobCards: JobCard[],
): ServiceReminder | null {
  if (!vehicleId) {
    return null;
  }
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) {
    return null;
  }
  return buildServiceReminder(vehicle, jobCards);
}

export function serviceReminderFollowUpNote(reminder: ServiceReminder): string {
  return reminder.note;
}

export function isServiceReminderFollowUp(followUp: CustomerFollowUp): boolean {
  return followUp.followUpType === 'service_reminder';
}

export function reminderStatusLabel(status: ServiceReminderStatus): string {
  switch (status) {
    case 'overdue':
      return 'Overdue';
    case 'due_soon':
      return 'Due soon';
    case 'ok':
      return 'OK';
    default:
      return 'Unknown';
  }
}

export function reminderStatusClass(status: ServiceReminderStatus): string {
  switch (status) {
    case 'overdue':
      return 'text-bg-danger';
    case 'due_soon':
      return 'text-bg-warning';
    case 'ok':
      return 'text-bg-success';
    default:
      return 'text-bg-secondary';
  }
}

export function supportedFuelTypesForReminders(): readonly string[] {
  return FUEL_TYPES;
}

export type { FuelType };
