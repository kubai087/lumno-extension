// Lumno's top toast, at the top of the popup, for pages that cannot show
// one themselves (browser pages, PDF viewers). Its element is made on first
// use and takes the popup's theme each time it shows.
import * as LumnoToast from '../../shared/ui/toast';

class PopupToast {
  private readonly doc: Document;
  private readonly win: Window;
  private shown: { element: HTMLElement; controller: ReturnType<typeof LumnoToast.createToastController> } | null = null;

  constructor(doc: Document, win: Window) {
    this.doc = doc;
    this.win = win;
  }

  show(message: string, duration: number): void {
    const shown = this.shown || this.create();
    if (this.doc.body.getAttribute('data-theme') === 'dark') {
      shown.element.setAttribute('data-theme', 'dark');
    } else {
      shown.element.removeAttribute('data-theme');
    }
    shown.controller.show(message, { duration });
  }

  private create(): NonNullable<PopupToast['shown']> {
    const element = this.doc.createElement('div');
    element.className = 'x-lumno-toast';
    element.setAttribute('data-show', 'false');
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.style.setProperty('--x-lumno-toast-top', '12px');
    this.doc.body.appendChild(element);
    this.shown = { element, controller: LumnoToast.createToastController(element, { windowObj: this.win }) };
    return this.shown;
  }
}

export { PopupToast };
