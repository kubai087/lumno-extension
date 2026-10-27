// The page's floating tooltip and its toast. The tooltip binds to every
// element with a data-tooltip hint; the toast announces errors more urgently
// than other messages.
import { isHtmlElement } from '../../shared/dom-guards';
import type { ToastController } from '../../shared/ui/toast-screen';
import type { TooltipController } from '../../shared/ui/tooltip';
import type { ToastTask } from '../options-types';

interface PageFeedbackDeps {
  doc: Document;
  tooltip: TooltipController;
  toast: ToastController | null;
  toastElement: HTMLElement | null;
}

const TOOLTIP_OPTIONS = Object.freeze({
  maxWidth: 'min(360px, calc(100vw - 24px))',
  spacing: 8
});

function createPageFeedback(deps: PageFeedbackDeps) {
  const { doc, tooltip, toast, toastElement } = deps;

  function showTooltipFor(target: HTMLElement | null): void {
    const text = target ? target.getAttribute('data-tooltip') : '';
    if (target && text) {
      tooltip.show(target, text, TOOLTIP_OPTIONS);
    }
  }

  function bindTooltips(): void {
    doc.querySelectorAll('[data-tooltip]').forEach((node) => {
      if (isHtmlElement(node)) {
        tooltip.bind(node, () => node.getAttribute('data-tooltip'), TOOLTIP_OPTIONS);
      }
    });
  }

  function setToastAnnouncement(errorToast: boolean): void {
    if (toastElement) {
      toastElement.setAttribute('role', errorToast ? 'alert' : 'status');
      toastElement.setAttribute('aria-live', errorToast ? 'assertive' : 'polite');
      toastElement.setAttribute('aria-atomic', 'true');
    }
  }

  function showToast(message: string, isError?: boolean): void {
    setToastAnnouncement(Boolean(isError));
    if (toast) {
      toast.show(message, { error: Boolean(isError) });
    }
  }

  // A task that may run long: its loading toast turns into the result in place.
  function beginToast(message: string): ToastTask {
    setToastAnnouncement(false);
    const task = toast ? toast.begin(message) : null;
    return {
      done(result) {
        setToastAnnouncement(false);
        if (task) task.done(result);
      },
      fail(result) {
        setToastAnnouncement(true);
        if (task) task.fail(result);
      },
      cancel() {
        if (task) task.cancel();
      }
    };
  }

  return { showTooltipFor, bindTooltips, hideTooltip: () => tooltip.hide(), showToast, beginToast };
}

export { createPageFeedback };
