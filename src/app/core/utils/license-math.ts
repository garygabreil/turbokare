import { AppLicense, LicensePlan, LicenseStatus, ProductMode } from '../models/license';

const MS_PER_DAY = 86_400_000;

export const LICENSE_PLAN_LABELS: Record<LicensePlan, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const LICENSE_PLAN_MONTHS: Record<LicensePlan, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export function allowedPlansForProduct(mode: ProductMode): LicensePlan[] {
  return mode === 'turbokare' ? ['yearly'] : ['monthly', 'quarterly', 'yearly'];
}

export function addMonths(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Build expiry timestamp from plan + start date (for new licenses). */
export function expiresAtForPlan(plan: LicensePlan, startsAt: number): number {
  return addMonths(new Date(startsAt), LICENSE_PLAN_MONTHS[plan]).getTime();
}

export function buildLicenseStatus(license: AppLicense | null | undefined): LicenseStatus {
  if (!license) {
    return {
      loaded: false,
      valid: false,
      expired: false,
      expiringSoon: false,
      daysLeft: 0,
      planLabel: '—',
      expiryLabel: '—',
      customerName: '',
    };
  }

  const now = Date.now();
  const daysLeft = Math.ceil((license.expiresAt - now) / MS_PER_DAY);
  const expired = !license.active || daysLeft < 0;
  const expiringSoon = !expired && daysLeft <= 30;

  return {
    loaded: true,
    valid: !expired,
    expired,
    expiringSoon,
    daysLeft: Math.max(daysLeft, 0),
    planLabel: LICENSE_PLAN_LABELS[license.plan] ?? license.plan,
    expiryLabel: new Date(license.expiresAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    customerName: license.customerName,
  };
}
