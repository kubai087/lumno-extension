// The overlay's toast: the parts show and hide it from the start, and it
// draws once the panel has mounted its toast element and controller.
import type { ToastController, ToastShowOptions } from '../../shared/ui/toast-screen';

class OverlayToast {
  private controller: Pick<ToastController, 'show' | 'hide'> | null = null;

  mount(controller: Pick<ToastController, 'show' | 'hide'>): void {
    this.controller = controller;
  }

  show(message: string, isError?: boolean, options?: ToastShowOptions): void {
    if (this.controller) {
      this.controller.show(message, { ...options, error: Boolean(isError) });
    }
  }

  hide(): void {
    if (this.controller) {
      this.controller.hide();
    }
  }
}

export { OverlayToast };
