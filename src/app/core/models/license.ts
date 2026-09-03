export type LicensePlan = 'monthly' | 'quarterly' | 'yearly';

export type ProductMode = 'turbokare' | 'garagepro';

export interface AppLicense {
  customerName: string;
  plan: LicensePlan;
  startsAt: number;
  expiresAt: number;
  active: boolean;
}

export interface LicenseStatus {
  loaded: boolean;
  valid: boolean;
  expired: boolean;
  expiringSoon: boolean;
  daysLeft: number;
  planLabel: string;
  expiryLabel: string;
  customerName: string;
}
