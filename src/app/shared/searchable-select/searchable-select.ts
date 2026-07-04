import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { focusNextFromElement } from '../../core/utils/focus-nav';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  data?: Record<string, unknown>;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  templateUrl: './searchable-select.html',
  styleUrl: './searchable-select.scss',
})
export class SearchableSelect {
  private readonly destroyRef = inject(DestroyRef);

  readonly options = input<SelectOption[]>([]);
  readonly value = input<string>('');
  readonly placeholder = input<string>('Search…');
  readonly invalid = input<boolean>(false);
  readonly inputId = input<string>('');
  /** Allow typed text that is not in the options list (free-text mode). */
  readonly allowCustom = input<boolean>(false);
  /** Uppercase dropdown labels and sublabels (e.g. invoice descriptions). */
  readonly uppercaseMenu = input<boolean>(false);

  readonly valueChange = output<string>();
  readonly searchChange = output<string>();
  readonly optionSelect = output<SelectOption>();

  readonly query = signal('');
  readonly open = signal(false);
  readonly highlightIndex = signal(0);
  readonly menuTop = signal(0);
  readonly menuLeft = signal(0);
  readonly menuWidth = signal(0);
  private readonly focused = signal(false);

  private readonly onViewportChange = (): void => {
    if (this.open()) {
      this.repositionMenu();
    }
  };

  constructor() {
    effect(() => {
      const val = this.value();
      const opts = this.options();
      if (!this.focused()) {
        if (this.allowCustom()) {
          this.query.set(val);
        } else {
          const match = opts.find((o) => o.value === val);
          this.query.set(match ? match.label : '');
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.onViewportChange, true);
      window.addEventListener('resize', this.onViewportChange);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', this.onViewportChange, true);
        window.removeEventListener('resize', this.onViewportChange);
      });
    }
  }

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    if (!q) {
      return opts.slice(0, 50);
    }
    return opts
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q),
      )
      .slice(0, 50);
  });

  private resetHighlight(): void {
    this.highlightIndex.set(0);
  }

  onFocus(): void {
    this.focused.set(true);
    this.open.set(true);
    this.resetHighlight();
    this.repositionMenu();
  }

  onBlur(): void {
    this.focused.set(false);
    setTimeout(() => {
      this.open.set(false);
      const q = this.query().trim();
      if (!q) {
        if (this.allowCustom()) {
          this.valueChange.emit('');
        }
        return;
      }
      const opts = this.options();
      const qLower = q.toLowerCase();
      const exact = opts.find((o) => o.label.toLowerCase() === qLower);
      if (exact) {
        this.select(exact);
        return;
      }
      const matches = opts.filter(
        (o) =>
          o.label.toLowerCase().includes(qLower) || (o.sublabel ?? '').toLowerCase().includes(qLower),
      );
      if (matches.length === 1) {
        this.select(matches[0]);
        return;
      }
      if (this.allowCustom()) {
        this.valueChange.emit(q);
      }
    }, 150);
  }

  onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.query.set(text);
    this.open.set(true);
    this.resetHighlight();
    this.repositionMenu();
    this.searchChange.emit(text);
    if (this.allowCustom()) {
      this.valueChange.emit(text);
      return;
    }
    const exact = this.options().find(
      (o) => o.label.toLowerCase() === text.trim().toLowerCase(),
    );
    this.valueChange.emit(exact ? exact.value : '');
  }

  select(opt: SelectOption, advance = false): void {
    this.query.set(opt.label);
    this.open.set(false);
    this.focused.set(false);
    this.searchChange.emit(opt.label);
    this.valueChange.emit(opt.value);
    this.optionSelect.emit(opt);
    if (advance) {
      const id = this.inputId();
      const el = id ? document.getElementById(id) : null;
      if (el) {
        setTimeout(() => focusNextFromElement(el));
      }
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const opts = this.filtered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      if (!opts.length) {
        return;
      }
      this.highlightIndex.update((i) => Math.min(i + 1, opts.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!opts.length) {
        return;
      }
      this.highlightIndex.update((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
      return;
    }
    if (event.key === 'Tab') {
      this.open.set(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (this.open() && opts.length) {
        const opt = opts[this.highlightIndex()] ?? opts[0];
        this.select(opt, true);
        return;
      }
      const id = this.inputId();
      const el = id ? document.getElementById(id) : null;
      if (el) {
        focusNextFromElement(el);
      }
    }
  }

  isHighlighted(index: number): boolean {
    return this.open() && this.highlightIndex() === index;
  }

  private repositionMenu(): void {
    const id = this.inputId();
    const el = id ? document.getElementById(id) : null;
    if (!el) {
      return;
    }
    const anchor = el.closest('.input-group') ?? el;
    const rect = anchor.getBoundingClientRect();
    this.menuTop.set(rect.bottom + 2);
    this.menuLeft.set(rect.left);
    this.menuWidth.set(rect.width);
  }
}
