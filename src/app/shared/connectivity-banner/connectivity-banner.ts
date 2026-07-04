import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConnectivityService } from '../../core/services/connectivity.service';

@Component({
  selector: 'app-connectivity-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './connectivity-banner.html',
  styleUrl: './connectivity-banner.scss',
})
export class ConnectivityBanner {
  readonly connectivity = inject(ConnectivityService);
}
