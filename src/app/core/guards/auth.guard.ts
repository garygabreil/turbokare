import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LicenseService } from '../services/license.service';

function licenseBlocked(): boolean {
  const license = inject(LicenseService);
  const status = license.status();
  return status.loaded && !status.valid;
}

export const licenseValidGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (licenseBlocked()) {
    return router.createUrlTree(['/license-expired']);
  }
  return true;
};

export const licenseExpiredPageGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!licenseBlocked()) {
    return router.createUrlTree(['/login']);
  }
  return true;
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
