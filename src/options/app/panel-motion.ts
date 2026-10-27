// The settings panel's height motion, once the panel is drawn: rows that a
// setting shows or hides animate the panel instead of jumping it. Before the
// panel exists, a layout change simply happens.
import { createPanelHeightAnimator, type LayoutMutation } from '../options-panel-motion';

class PanelMotion {
  private animator: ReturnType<typeof createPanelHeightAnimator> | null = null;

  // The reserve host keeps room below the panel while it animates.
  attach(panel: HTMLElement, reserveHost: HTMLElement, doc: Document, win: Window): void {
    this.animator = createPanelHeightAnimator({ panel, reserveHost, documentObj: doc, windowObj: win });
  }

  animate(mutateLayout: LayoutMutation): boolean {
    return this.animator ? this.animator.animate(mutateLayout) : mutateLayout();
  }

  cancel(): void {
    if (this.animator) {
      this.animator.cancel();
    }
  }
}

export { PanelMotion };
