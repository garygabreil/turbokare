import { firstValueFrom } from 'rxjs';
import { CustomerFollowUp, JobCard, Vehicle } from '../models';
import { FollowUpService } from '../services/follow-up.service';
import {
  buildAllServiceReminders,
  isServiceReminderFollowUp,
  serviceReminderFollowUpNote,
  ServiceReminder,
} from './service-reminder';

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function existingReminderFollowUp(
  followUps: CustomerFollowUp[],
  vehicleId: string,
): CustomerFollowUp | undefined {
  return followUps.find(
    (fu) =>
      fu.vehicleId === vehicleId &&
      fu.status === 'pending' &&
      isServiceReminderFollowUp(fu),
  );
}

export async function syncServiceReminderFollowUps(
  followUpService: FollowUpService,
  vehicles: Vehicle[],
  jobCards: JobCard[],
  createdBy?: string,
): Promise<number> {
  const followUps = await firstValueFrom(followUpService.list());
  const actionable = buildAllServiceReminders(vehicles, jobCards);
  let created = 0;

  for (const reminder of actionable) {
    if (reminder.status !== 'due_soon' && reminder.status !== 'overdue') {
      continue;
    }
    if (!reminder.vehicleId || !reminder.customerId) {
      continue;
    }
    if (existingReminderFollowUp(followUps, reminder.vehicleId)) {
      continue;
    }

    await followUpService.create({
      customerId: reminder.customerId,
      customerName: reminder.customerName,
      vehicleId: reminder.vehicleId,
      vehicleLabel: reminder.vehicleLabel,
      note: serviceReminderFollowUpNote(reminder),
      dueDate: todayDateInput(),
      status: 'pending',
      followUpType: 'service_reminder',
      createdBy,
    } as never);
    created += 1;
  }

  return created;
}

export async function completeServiceRemindersForVehicle(
  followUpService: FollowUpService,
  vehicleId: string,
): Promise<void> {
  const followUps = await firstValueFrom(followUpService.list());
  const pending = followUps.filter(
    (fu) =>
      fu.vehicleId === vehicleId &&
      fu.status === 'pending' &&
      isServiceReminderFollowUp(fu),
  );

  for (const fu of pending) {
    if (!fu.id) {
      continue;
    }
    await followUpService.update(fu.id, {
      status: 'done',
      completedAt: Date.now(),
    });
  }
}

export function formatReminderSummary(reminder: ServiceReminder): string {
  if (reminder.status === 'overdue') {
    return `${Math.abs(reminder.kmRemaining).toLocaleString('en-IN')} km overdue`;
  }
  return `${reminder.kmRemaining.toLocaleString('en-IN')} km to service`;
}
