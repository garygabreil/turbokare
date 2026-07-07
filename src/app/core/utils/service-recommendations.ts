import { FormArray, FormBuilder, Validators } from '@angular/forms';
import {
  RecommendationPriority,
  RecommendationStatus,
  ServiceRecommendation,
} from '../models';

export const RECOMMENDATION_PRIORITIES: { value: RecommendationPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'soon', label: 'Soon' },
  { value: 'optional', label: 'Optional' },
];

export const RECOMMENDATION_STATUSES: { value: RecommendationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'scheduled', label: 'Scheduled' },
];

export function newRecommendationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultFollowUpDueDate(monthsAhead = 3): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  return date.toISOString().slice(0, 10);
}

export function recommendationFollowUpNote(description: string): string {
  return `Service recommendation: ${description.trim()}`;
}

export function createRecommendationGroup(
  fb: FormBuilder,
  item?: ServiceRecommendation,
) {
  return fb.nonNullable.group({
    id: [item?.id ?? newRecommendationId()],
    description: [item?.description ?? '', [Validators.required, Validators.minLength(2)]],
    estimatedCost: [item?.estimatedCost ?? null as number | null, [Validators.min(0)]],
    priority: [item?.priority ?? ('soon' as RecommendationPriority), [Validators.required]],
    status: [item?.status ?? ('pending' as RecommendationStatus), [Validators.required]],
    notes: [item?.notes ?? ''],
  });
}

export function recommendationsFromArray(array: FormArray): ServiceRecommendation[] {
  return array.getRawValue() as ServiceRecommendation[];
}

export function priorityLabel(priority: RecommendationPriority): string {
  return RECOMMENDATION_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

export function statusLabel(status: RecommendationStatus): string {
  return RECOMMENDATION_STATUSES.find((s) => s.value === status)?.label ?? status;
}
