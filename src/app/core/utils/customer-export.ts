import { Customer } from '../models';
import { DayFilterMode, todayDateInput } from './date-filter';

export type CustomerListExportSource = {
  customer: Customer;
  vehicleCount: number;
  jobCount: number;
  pendingFollowUps: number;
  lastVisit: number | null;
};

export type CustomerExportRow = {
  name: string;
  phone: string;
  email: string;
  vehicles: string;
  jobs: string;
  pendingFollowUps: string;
  registered: string;
  lastVisit: string;
  repeat: string;
};

export const CUSTOMER_CSV_COLUMNS: { key: keyof CustomerExportRow; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'pendingFollowUps', label: 'Pending follow-ups' },
  { key: 'registered', label: 'Registered' },
  { key: 'lastVisit', label: 'Last visit' },
  { key: 'repeat', label: 'Repeat customer' },
];

function formatExportDate(ts: number | null | undefined): string {
  if (!ts) {
    return '';
  }
  return new Date(ts).toLocaleDateString('en-IN');
}

export function customerExportRows(rows: CustomerListExportSource[]): CustomerExportRow[] {
  return rows.map((row) => ({
    name: row.customer.name,
    phone: row.customer.phone,
    email: row.customer.email ?? '',
    vehicles: String(row.vehicleCount),
    jobs: String(row.jobCount),
    pendingFollowUps: String(row.pendingFollowUps),
    registered: formatExportDate(row.customer.createdAt),
    lastVisit: formatExportDate(row.lastVisit),
    repeat: row.jobCount >= 2 ? 'Yes' : 'No',
  }));
}

export function customerListExportFilename(
  dayMode: DayFilterMode,
  viewDate: string,
  segment: string,
): string {
  const parts = ['customers'];
  if (dayMode === 'today') {
    parts.push(todayDateInput());
  } else if (dayMode === 'date') {
    parts.push(viewDate);
  } else {
    parts.push('all');
  }
  if (segment !== 'all') {
    parts.push(segment);
  }
  return parts.join('-');
}
