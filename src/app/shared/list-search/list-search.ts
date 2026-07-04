import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-list-search',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="list-search">
      <span class="list-search-icon"><i class="bi bi-search"></i></span>
      <input
        type="search"
        class="list-search-input"
        [placeholder]="placeholder()"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
      />
    </div>
  `,
  styleUrl: './list-search.scss',
})
export class ListSearch {
  readonly placeholder = input('Search…');
  readonly value = model('');
}
