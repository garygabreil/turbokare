import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { advanceFocus, submitForm } from '../../core/utils/focus-nav';

@Directive({
  selector: 'form[appFormKeyboard]',
  standalone: true,
})
export class FormKeyboardDirective {
  private readonly el = inject(ElementRef<HTMLFormElement>);

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const target = event.target as HTMLElement;
    const tag = target.tagName;

    if (tag === 'TEXTAREA') {
      return;
    }
    if (tag === 'BUTTON') {
      return;
    }
    if (tag === 'A') {
      return;
    }
    if (target.closest('.searchable-select')) {
      return;
    }

    if (tag === 'INPUT' || tag === 'SELECT') {
      const form = this.el.nativeElement;
      event.preventDefault();
      if (!advanceFocus(target, form)) {
        submitForm(form);
      }
    }
  }
}
