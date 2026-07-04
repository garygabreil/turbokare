import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './shared/toast-container/toast-container';
import { ConnectivityBanner } from './shared/connectivity-banner/connectivity-banner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainer, ConnectivityBanner],
  template: `
    <app-connectivity-banner />
    <router-outlet />
    <app-toast-container />
  `,
})
export class App {}
