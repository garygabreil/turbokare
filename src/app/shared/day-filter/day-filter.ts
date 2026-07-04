import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DayFilterMode, todayDateInput } from '../../core/utils/date-filter';

@Component({
  selector: 'app-day-filter',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './day-filter.html',
  styleUrl: './day-filter.scss',
})
export class DayFilter {
  readonly mode = model<DayFilterMode>('today');
  readonly selectedDate = model(todayDateInput());

  setToday(): void {
    this.mode.set('today');
    this.selectedDate.set(todayDateInput());
  }

  setAll(): void {
    this.mode.set('all');
  }

  onDateChange(value: string): void {
    this.selectedDate.set(value);
    this.mode.set(value === todayDateInput() ? 'today' : 'date');
  }
}
