// The onboarding frame's measured layout: the title scaled to fit its line,
// the frame scaled to the window, the visual canvas scaled to its slot (or,
// stacked on narrow windows, to what the copy leaves), and the stacked page
// scrolled back to the top on a new slide.
import { getHtmlElement, queryHtmlElement } from '../../shared/dom-lookup';

const ONBOARDING_FRAME_WIDTH = 1240;
const ONBOARDING_FRAME_HEIGHT = 680;
const VISUAL_CANVAS_WIDTH = 704;
const VISUAL_CANVAS_HEIGHT = 680;

class OnboardingLayout {
  private readonly root: HTMLElement;
  private readonly doc: Document;
  private readonly win: Window;
  private titleFitFrame = 0;
  private visualScaleFrame = 0;

  constructor(root: HTMLElement, doc: Document, win: Window) {
    this.root = root;
    this.doc = doc;
    this.win = win;
  }

  // The columns the root draws.
  private get copyPanel(): HTMLElement | null {
    return getHtmlElement(this.doc, 'onboarding-copy-panel');
  }

  private get visualSlot(): HTMLElement | null {
    return getHtmlElement(this.doc, 'onboarding-visual-slot');
  }

  private get visualPanel(): HTMLElement | null {
    return getHtmlElement(this.doc, 'onboarding-visual-panel');
  }

  private get visualCanvas(): HTMLElement | null {
    return getHtmlElement(this.doc, 'onboarding-visual-canvas');
  }

  // Measures on every resize of the window or the visual's slot.
  follow(): void {
    this.scheduleTitleFitUpdate();
    this.scheduleVisualCanvasScaleUpdate();
    this.win.addEventListener('resize', () => {
      this.scheduleTitleFitUpdate();
      this.scheduleVisualCanvasScaleUpdate();
    });
    const slot = this.visualSlot;
    if (slot && typeof ResizeObserver === 'function') {
      new ResizeObserver(() => this.scheduleVisualCanvasScaleUpdate()).observe(slot);
    }
  }

  // Lays the copy out where it stands, so a change from there animates.
  layoutCopy(): void {
    [this.getTitle(), getHtmlElement(this.doc, 'onboarding-body')].forEach((element) => {
      if (element) {
        void element.offsetHeight;
      }
    });
  }

  private getTitle(): HTMLElement | null {
    return getHtmlElement(this.doc, 'onboarding-title');
  }

  private getTitleFitLines(): Element[] {
    const title = this.getTitle();
    if (!title) {
      return [];
    }
    const lines = Array.from(title.querySelectorAll('.title-line'));
    return lines.length > 0 ? lines : [title];
  }

  private updateTitleFitScale(): void {
    const title = this.getTitle();
    if (!title) {
      return;
    }
    title.style.setProperty('--title-fit-scale', '1');
    if (title.dataset.empty === 'true') {
      return;
    }
    const availableWidth = title.clientWidth;
    if (!availableWidth) {
      return;
    }
    const widestLine = this.getTitleFitLines().reduce((maxWidth, line) => {
      return Math.max(maxWidth, line.scrollWidth || line.getBoundingClientRect().width || 0);
    }, 0);
    if (!widestLine) {
      return;
    }
    // Translated titles can run much longer than the English or Chinese
    // ones, so the floor is low enough for them to still fit on one line.
    const scale = Math.max(0.6, Math.min(1, availableWidth / widestLine));
    title.style.setProperty('--title-fit-scale', scale.toFixed(3));
  }

  scheduleTitleFitUpdate(): void {
    if (typeof this.win.requestAnimationFrame !== 'function') {
      this.updateTitleFitScale();
      return;
    }
    if (this.titleFitFrame) {
      this.win.cancelAnimationFrame(this.titleFitFrame);
    }
    this.titleFitFrame = this.win.requestAnimationFrame(() => {
      this.titleFitFrame = 0;
      this.updateTitleFitScale();
    });
  }

  private isFrameScaledOnboardingLayout(): boolean {
    return typeof this.win.matchMedia === 'function' &&
      this.win.matchMedia('(max-width: 1240px) and (min-width: 860px), (max-height: 760px) and (min-height: 560px) and (min-width: 860px)').matches;
  }

  private isStackedOnboardingLayout(): boolean {
    return typeof this.win.matchMedia === 'function' &&
      this.win.matchMedia('(max-width: 859px), (max-height: 559px)').matches;
  }

  resetStackedLayoutScroll(): void {
    if (!this.root || !this.isStackedOnboardingLayout()) {
      return;
    }
    this.root.scrollTop = 0;
    if (typeof this.win.requestAnimationFrame !== 'function') {
      return;
    }
    this.win.requestAnimationFrame(() => {
      if (!this.root || !this.isStackedOnboardingLayout()) {
        return;
      }
      this.root.scrollTop = 0;
    });
  }

  private updateOnboardingFrameScale(): void {
    if (!this.root) {
      return;
    }
    const shouldScaleFrame = this.isFrameScaledOnboardingLayout();
    const viewportWidth = this.win.innerWidth || this.root.clientWidth || ONBOARDING_FRAME_WIDTH;
    const viewportHeight = this.win.innerHeight || this.root.clientHeight || ONBOARDING_FRAME_HEIGHT;
    const scale = shouldScaleFrame
      ? Math.max(0.1, Math.min(1, viewportWidth / ONBOARDING_FRAME_WIDTH, viewportHeight / ONBOARDING_FRAME_HEIGHT))
      : 1;
    this.root.style.setProperty('--onboarding-frame-scale', scale.toFixed(3));
    this.root.style.setProperty('--onboarding-frame-rendered-width', `${(ONBOARDING_FRAME_WIDTH * scale).toFixed(2)}px`);
    this.root.style.setProperty('--onboarding-frame-rendered-height', `${(ONBOARDING_FRAME_HEIGHT * scale).toFixed(2)}px`);
  }

  private getCompactCopyContentHeight(): number {
    const copyPanel = this.copyPanel;
    if (!copyPanel) {
      return 0;
    }
    const panelStyle = this.win.getComputedStyle(copyPanel);
    const paddingTop = parseFloat(panelStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(panelStyle.paddingBottom) || 0;
    const rowGap = parseFloat(panelStyle.rowGap || panelStyle.gap) || 0;
    // The rows on screen.
    const rows: HTMLElement[] = [];
    ['.copy-block', '.interaction-slots', '.onboarding-copy-actions'].forEach((selector) => {
      const element = queryHtmlElement(copyPanel, selector);
      if (!element || element.hidden) {
        return;
      }
      const elementStyle = this.win.getComputedStyle(element);
      if (elementStyle.display !== 'none' && elementStyle.visibility !== 'hidden') {
        rows.push(element);
      }
    });
    const rowsHeight = rows.reduce((sum, element) => (
      sum + element.getBoundingClientRect().height
    ), 0);
    return paddingTop + paddingBottom + rowsHeight + (Math.max(0, rows.length - 1) * rowGap);
  }

  // The room the visual has: its slot, or, stacked on narrow windows, the
  // window's width and what the copy leaves of its height.
  private measureVisualSpace(visualSlot: HTMLElement): { width: number; height: number; compact: boolean } {
    const rect = visualSlot.getBoundingClientRect();
    const compact = this.isStackedOnboardingLayout();
    if (!compact) {
      return { width: visualSlot.clientWidth || rect.width || 0, height: visualSlot.clientHeight || rect.height || 0, compact };
    }
    const viewportWidth = this.win.innerWidth || this.root.clientWidth || VISUAL_CANVAS_WIDTH;
    const viewportHeight = this.win.innerHeight || this.root.clientHeight || VISUAL_CANVAS_HEIGHT;
    // A previous oversized visual squeezes the copy rows (min-height: 0), so
    // collapse it first and measure the copy at its natural height.
    this.root.style.setProperty('--onboarding-visual-rendered-height', '0px');
    return {
      width: Math.min(viewportWidth, visualSlot.clientWidth || rect.width || viewportWidth),
      height: Math.max(0, viewportHeight - this.getCompactCopyContentHeight()),
      compact
    };
  }

  private updateVisualCanvasScale(): void {
    const visualSlot = this.visualSlot;
    if (!visualSlot || !this.visualPanel || !this.visualCanvas) {
      return;
    }
    this.updateOnboardingFrameScale();
    const space = this.measureVisualSpace(visualSlot);
    if (!space.width || (!space.compact && !space.height)) {
      return;
    }
    // Stacked, the visual may grow past its own size to fill the width.
    const fit = Math.min(space.width / VISUAL_CANVAS_WIDTH, space.height / VISUAL_CANVAS_HEIGHT);
    const scale = Math.max(0.1, space.compact ? fit : Math.min(1, fit));
    this.root.style.setProperty('--onboarding-visual-scale', scale.toFixed(3));
    this.root.style.setProperty('--onboarding-visual-rendered-width', `${(VISUAL_CANVAS_WIDTH * scale).toFixed(2)}px`);
    this.root.style.setProperty('--onboarding-visual-rendered-height', `${(VISUAL_CANVAS_HEIGHT * scale).toFixed(2)}px`);
  }

  scheduleVisualCanvasScaleUpdate(): void {
    if (!this.visualCanvas || typeof this.win.requestAnimationFrame !== 'function') {
      this.updateVisualCanvasScale();
      return;
    }
    if (this.visualScaleFrame) {
      this.win.cancelAnimationFrame(this.visualScaleFrame);
    }
    this.visualScaleFrame = this.win.requestAnimationFrame(() => {
      this.visualScaleFrame = 0;
      this.updateVisualCanvasScale();
    });
  }
}

export { OnboardingLayout };
