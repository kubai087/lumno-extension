// The Toast the in-page surfaces share, drawn straight into its element.
import { NOOP_CONTROLLER, ToastScreen } from './toast-screen';
import type { ToastController, ToastControllerOptions, ToastMessage, ToastSurface, ToastTone } from './toast-screen';
import { createStore } from '../state/store';

// The toast element, or a test double; the optional members may be missing.
interface ToastElement {
  style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
  replaceChildren?(...nodes: Array<Node | string>): void;
  ownerDocument?: Document | null;
}

function renderToast(element: ToastElement, text: string, tone: ToastTone): void {
  const doc = element.ownerDocument;
  if (tone === 'loading' && doc && element.replaceChildren) {
    const spinner = doc.createElement('span');
    spinner.className = 'x-lumno-toast-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    element.replaceChildren(spinner, doc.createTextNode(text));
  } else {
    element.textContent = text;
  }
  if (tone) {
    element.setAttribute('data-tone', tone);
  } else if (element.removeAttribute) {
    element.removeAttribute('data-tone');
  } else {
    element.setAttribute('data-tone', '');
  }
  element.setAttribute('data-show', 'true');
}

function createDomSurface(element: ToastElement): ToastSurface {
  const message = createStore<ToastMessage>({ visible: false, text: '', tone: '' });
  message.subscribe(() => {
    const { visible, text, tone } = message.getSnapshot();
    if (visible) {
      renderToast(element, text, tone);
    } else {
      element.setAttribute('data-show', 'false');
    }
  });
  return { message };
}

function createToastController(
  toastElement: ToastElement | null | undefined,
  options?: ToastControllerOptions | null
): ToastController {
  return toastElement ? new ToastScreen(createDomSurface(toastElement), options) : NOOP_CONTROLLER;
}

export type { ToastElement };
export { createToastController };
