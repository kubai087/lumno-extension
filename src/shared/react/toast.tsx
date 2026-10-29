// The Toast of the extension's own pages, drawn by the page's React root.
import type { PortalHost } from './portal-host';
import { NOOP_CONTROLLER, ToastScreen } from '../ui/toast-screen';
import type { ToastController, ToastControllerOptions, ToastSurface } from '../ui/toast-screen';

function createReactSurface(host: HTMLElement, portals: PortalHost): ToastSurface {
  host.setAttribute('data-react-island', 'toast');
  return {
    render(text, tone) {
      portals.show(host, tone === 'loading' ? (
        <>
          <span aria-hidden="true" className="x-lumno-toast-spinner" />
          {text}
        </>
      ) : (
        text
      ));
      if (tone) {
        host.setAttribute('data-tone', tone);
      } else {
        host.removeAttribute('data-tone');
      }
      host.setAttribute('data-show', 'true');
    },
    hide() {
      host.setAttribute('data-show', 'false');
    },
    destroy() {
      portals.remove(host);
    }
  };
}

export function createToastController(
  toastElement: HTMLElement | null,
  portals: PortalHost,
  options?: ToastControllerOptions | null
): ToastController {
  return toastElement ? new ToastScreen(createReactSurface(toastElement, portals), options) : NOOP_CONTROLLER;
}
