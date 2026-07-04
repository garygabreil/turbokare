const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('.no-print') && el.offsetParent !== null && !el.hasAttribute('disabled'),
  );
}

export function advanceFocus(current: HTMLElement, root: HTMLElement): boolean {
  const focusable = getFocusableElements(root);
  const idx = focusable.indexOf(current);
  if (idx >= 0 && idx < focusable.length - 1) {
    focusable[idx + 1].focus();
    if (focusable[idx + 1] instanceof HTMLInputElement) {
      (focusable[idx + 1] as HTMLInputElement).select?.();
    }
    return true;
  }
  return false;
}

export function focusNextFromElement(el: HTMLElement, root?: HTMLElement): boolean {
  const container = root ?? (el.closest('form') as HTMLElement) ?? document.body;
  return advanceFocus(el, container);
}

export function submitForm(form: HTMLFormElement): void {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled])');
  if (submit) {
    submit.click();
  } else {
    form.requestSubmit();
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
