// The bottom dock's mounted parts: its scroller, the layout controller that
// places the search box and the sections, and the motion that slides them
// together. Each is null until the dock is made.
import type { LayoutController } from '../layout';
import type { LayoutMotion } from '../layout-motion';

class BottomDockParts {
  private dockScroller: HTMLElement | null = null;
  private controller: LayoutController | null = null;
  private motion: LayoutMotion | null = null;

  get scroller(): HTMLElement | null {
    return this.dockScroller;
  }

  get layoutController(): LayoutController | null {
    return this.controller;
  }

  get layoutMotion(): LayoutMotion | null {
    return this.motion;
  }

  mount(parts: { scroller: HTMLElement | null; layoutController: LayoutController; layoutMotion: LayoutMotion }): void {
    this.dockScroller = parts.scroller;
    this.controller = parts.layoutController;
    this.motion = parts.layoutMotion;
  }
}

export { BottomDockParts };
