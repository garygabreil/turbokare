import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'job-cards',
        loadComponent: () =>
          import('./features/job-cards/job-card-list/job-card-list').then((m) => m.JobCardList),
      },
      {
        path: 'job-cards/new',
        loadComponent: () =>
          import('./features/job-cards/job-card-form/job-card-form').then((m) => m.JobCardForm),
      },
      {
        path: 'job-cards/:id/edit',
        loadComponent: () =>
          import('./features/job-cards/job-card-form/job-card-form').then((m) => m.JobCardForm),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customer-list/customer-list').then((m) => m.CustomerList),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./features/customers/customer-detail/customer-detail').then((m) => m.CustomerDetail),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/part-list/part-list').then((m) => m.PartList),
      },
      {
        path: 'inventory/new',
        loadComponent: () =>
          import('./features/inventory/part-form/part-form').then((m) => m.PartForm),
      },
      {
        path: 'inventory/:id/edit',
        loadComponent: () =>
          import('./features/inventory/part-form/part-form').then((m) => m.PartForm),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/invoices/invoice-list/invoice-list').then((m) => m.InvoiceList),
      },
      {
        path: 'invoices/new',
        loadComponent: () =>
          import('./features/invoices/invoice-form/invoice-form').then((m) => m.InvoiceForm),
      },
      {
        path: 'invoices/:id/print',
        loadComponent: () =>
          import('./features/invoices/invoice-print/invoice-print').then((m) => m.InvoicePrint),
      },
      {
        path: 'invoices/:id/edit',
        loadComponent: () =>
          import('./features/invoices/invoice-form/invoice-form').then((m) => m.InvoiceForm),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
