// The Toast of the extension's own pages, drawn by the page's React root.
import type { PortalHost } from './portal-host';
import { NOOP_CONTROLLER, ToastScreen } from '../ui/toast-screen';
import type { ToastController, ToastControllerOptions, ToastMessage, ToastSurface } from '../ui/toast-screen';
import { useLayoutEffect } from 'react';
import { createViewStore } from './view-store';
import { useStore } from './use-store';
import type { Store } from '../state/store';

// The message the Toast sets, with its tone and visibility on the host.
function ToastContent({ host, message }: { host: HTMLElement; message: Store<ToastMessage> }) {
  const { visible, text, tone } = useStore(message);
  useLayoutEffect(() => {
    if (tone) {
      host.setAttribute('data-tone', tone);
    } else {
      host.removeAttribute('data-tone');
    }
    host.setAttribute('data-show', visible ? 'true' : 'false');
  }, [host, visible, tone]);
  return tone === 'loading' ? (
    <>
      <span aria-hidden="true" className="x-lumno-toast-spinner" />
      {text}
    </>
  ) : text;
}

function createReactSurface(host: HTMLElement, portals: PortalHost): ToastSurface {
  host.setAttribute('data-react-island', 'toast');
  const message = createViewStore<ToastMessage>({ visible: false, text: '', tone: '' });
  portals.show(host, <ToastContent host={host} message={message} />);
  return {
    message,
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
