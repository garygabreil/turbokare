import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-loading',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-loading.html',
  styleUrl: './page-loading.scss',
})
export class PageLoading {
  readonly loading = input(false);
  readonly message = input('Loading…');
}
