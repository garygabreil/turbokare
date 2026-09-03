import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { GARAGE_PROFILE } from '../constants/garage-profile';
import { AppLicense } from '../models/license';
import { allowedPlansForProduct, buildLicenseStatus, expiresAtForPlan } from '../utils/license-math';
import { environment } from '../../../environments/environment';

const MS_PER_DAY = 86_400_000;

/** Default TurboKare yearly license — expires in 1 day (demo / until Firestore doc is set). */
function defaultTurboKareLicense(): AppLicense {
  const expiresAt = Date.now() + MS_PER_DAY;
  const startsAt = expiresAt - 365 * MS_PER_DAY;
  return {
    customerName: GARAGE_PROFILE.name,
    plan: 'yearly',
    startsAt,
    expiresAt,
    active: true,
  };
}

@Injectable({ providedIn: 'root' })
export class LicenseService {
  private readonly firestore = inject(Firestore);
  private readonly mode = environment.product?.mode ?? 'garagepro';

  private readonly firestoreLicense = toSignal(
    docData(doc(this.firestore, 'settings', 'license')),
    { initialValue: undefined as AppLicense | undefined },
  );

  readonly license = computed<AppLicense>(() => {
    const remote = this.firestoreLicense() as AppLicense | undefined;
    if (remote?.expiresAt && remote?.plan) {
      return remote;
    }
    if (this.mode === 'turbokare') {
      return defaultTurboKareLicense();
    }
    return {
      customerName: environment.product?.displayName ?? 'GaragePro',
      plan: 'monthly',
      startsAt: Date.now(),
      expiresAt: expiresAtForPlan('monthly', Date.now()),
      active: true,
    };
  });

  readonly status = computed(() => buildLicenseStatus(this.license()));
  readonly productMode = computed(() => this.mode);
  readonly allowedPlans = computed(() => allowedPlansForProduct(this.mode));

  daysLeftLabel(days: number): string {
    if (days === 0) {
      return 'Expires today';
    }
    if (days === 1) {
      return '1 day left';
    }
    return `${days} days left`;
  }
}
