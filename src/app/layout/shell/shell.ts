import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly user = this.auth.user;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'bi-speedometer2' },
    { label: 'Customers', path: '/customers', icon: 'bi-people' },
    { label: 'Vehicles', path: '/vehicles', icon: 'bi-car-front' },
    { label: 'Job Cards', path: '/job-cards', icon: 'bi-clipboard2-check' },
    { label: 'Inventory', path: '/inventory', icon: 'bi-box-seam' },
    { label: 'Invoices', path: '/invoices', icon: 'bi-receipt' },
    { label: 'Reports', path: '/reports', icon: 'bi-bar-chart-line' },
  ];

  logout(): void {
    this.auth.logout();
    this.notify.info('You have been signed out.');
    this.router.navigate(['/login']);
  }
}
