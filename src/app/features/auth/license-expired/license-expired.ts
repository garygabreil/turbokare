import { LowerCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { GARAGE_PROFILE } from '../../../core/constants/garage-profile';
import { LicenseService } from '../../../core/services/license.service';

@Component({
  selector: 'app-license-expired',
  standalone: true,
  imports: [LowerCasePipe],
  templateUrl: './license-expired.html',
  styleUrl: './license-expired.scss',
})
export class LicenseExpired {
  readonly license = inject(LicenseService);
  readonly garage = GARAGE_PROFILE;
  readonly year = new Date().getFullYear();
}
