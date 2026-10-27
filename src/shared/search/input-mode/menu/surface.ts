// Where the mode menu sits and how it shows: its offset below the results,
// its height capped to the viewport, the frame that lets the open motion
// play, and the footer lined up with the tiles' icons.
import { queryHtmlElement } from '../../../dom-lookup';
import { setStyle } from '../page';
import type { ModeMenuDrawing } from './drawing';
import type { ModeMenuState } from './state';

interface FitModeMenuOptions {
  // The viewport's bottom edge, when the surface knows it better.
  viewportBottom?: number;
  bottomInset?: number;
  // The height the results above the menu take before the menu caps them.
  resultHeight?: number;
}

interface ModeMenuLayoutChange {
  menuElement: HTMLElement;
  open: boolean;
}

// The page window, or a stand-in with the members used here.
type ModeMenuSurfaceWindow = Partial<Pick<Window,
  'visualViewport' | 'innerHeight' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'setTimeout' | 'clearTimeout'>>;

interface ModeMenuSurfaceParts {
  menu: HTMLElement;
  content: HTMLElement;
  footer: HTMLElement;
  // The input's container, which the menu hangs below.
  container: HTMLElement;
  win: ModeMenuSurfaceWindow | null | undefined;
  doc: Document | null | undefined;
  onLayoutChange?(details: ModeMenuLayoutChange): void;
}

const VIEWPORT_MAX_HEIGHT_PROPERTY = '--x-lumno-search-mode-menu-viewport-max-height';
const DEFAULT_VIEWPORT_BOTTOM_INSET = 24;
// The menu gives way to the results above it down to this height; past it
// the results scroll instead.
const MIN_MENU_HEIGHT = 200;

// The bottom edge of the visible viewport, unless the caller names one.
function readViewportBottom(parts: ModeMenuSurfaceParts, fitOptions: FitModeMenuOptions): number {
  const configuredViewportBottom = Number(fitOptions.viewportBottom);
  if (Number.isFinite(configuredViewportBottom)) {
    return configuredViewportBottom;
  }
  const { win, doc } = parts;
  const visualViewport = win && win.visualViewport;
  if (visualViewport && Number.isFinite(Number(visualViewport.height))) {
    return Math.max(0, Number(visualViewport.offsetTop) || 0) + Math.max(0, Number(visualViewport.height) || 0);
  }
  return Math.max(
    0,
    Number(win && win.innerHeight) || Number(doc && doc.documentElement && doc.documentElement.clientHeight) || 0
  );
}

// The container's vertical scale (a transformed ancestor), with its
// layout height and rect.
function readContainerScale(container: HTMLElement): { rect: DOMRect; layoutHeight: number; scaleY: number } {
  const rect = container.getBoundingClientRect();
  const layoutHeight = Math.max(0, Number(container.offsetHeight) || Number(rect.height) || 0);
  const renderedHeight = Math.max(0, Number(rect.height) || layoutHeight);
  return { rect, layoutHeight, scaleY: layoutHeight > 0 ? renderedHeight / layoutHeight : 1 };
}

// Fits the results and the menu below them into the viewport under the
// input: the results keep their height and the menu takes the rest, down to
// MIN_MENU_HEIGHT. Returns the height the results may take.
function fitOpenMenu(parts: ModeMenuSurfaceParts, fitOptions: FitModeMenuOptions): number | null {
  const { menu } = parts;
  const { rect: containerRect, layoutHeight: containerLayoutHeight, scaleY } = readContainerScale(parts.container);
  if (!Number.isFinite(scaleY) || scaleY <= 0) {
    return null;
  }
  const configuredBottomInset = Number(fitOptions.bottomInset);
  const bottomInset = Number.isFinite(configuredBottomInset)
    ? Math.max(0, configuredBottomInset)
    : DEFAULT_VIEWPORT_BOTTOM_INSET;
  const menuGap = Math.max(0, (Number(menu.offsetTop) || containerLayoutHeight) - containerLayoutHeight);
  const availableLayoutHeight = Math.max(
    0,
    ((readViewportBottom(parts, fitOptions) - bottomInset - Number(containerRect.bottom || 0)) / scaleY) - menuGap
  );
  const resultLimit = Math.max(0, Math.floor(availableLayoutHeight - MIN_MENU_HEIGHT));
  const resultHeight = Math.min(resultLimit, Math.max(0, Number(fitOptions.resultHeight) || 0));
  setStyle(menu, VIEWPORT_MAX_HEIGHT_PROPERTY, `${Math.floor(availableLayoutHeight - resultHeight)}px`);
  return resultLimit;
}

class ModeMenuSurface {
  private readonly parts: ModeMenuSurfaceParts;
  private readonly state: ModeMenuState;
  private readonly drawing: ModeMenuDrawing;
  private revealFrame = 0;
  private revealFrameKind: '' | 'animation' | 'timeout' = '';

  constructor(parts: ModeMenuSurfaceParts, state: ModeMenuState, drawing: ModeMenuDrawing) {
    this.parts = parts;
    this.state = state;
    this.drawing = drawing;
  }

  // Moves the menu down by the height of the results shown above it.
  setResultOffset(offset: unknown): void {
    const numericOffset = Number(offset);
    const nextOffset = Number.isFinite(numericOffset) ? Math.max(0, numericOffset) : 0;
    setStyle(this.parts.menu, '--x-lumno-search-mode-menu-result-offset', `${nextOffset}px`);
  }

  // Fits the results and the menu into the viewport below the input;
  // returns the height the results may take, or null while it is closed.
  fitWithinViewport(options?: FitModeMenuOptions | null): number | null {
    if (!this.isVisible()) {
      this.parts.menu.style.removeProperty(VIEWPORT_MAX_HEIGHT_PROPERTY);
      return null;
    }
    return fitOpenMenu(this.parts, options || {});
  }

  isVisible(): boolean {
    return !this.state.destroyed && this.state.open;
  }

  notifyLayoutChange(): void {
    if (typeof this.parts.onLayoutChange === 'function') {
      this.parts.onLayoutChange({ menuElement: this.parts.menu, open: this.state.open });
    }
  }

  // Draws the menu closed for a frame, then open, so the open motion
  // plays; not if it closed by then.
  reveal(): void {
    this.state.revealed = false;
    this.drawing.draw();
    this.requestRevealFrame(() => {
      if (this.state.open) {
        this.state.revealed = true;
        this.drawing.draw();
      }
    });
  }

  conceal(): void {
    this.state.revealed = false;
    this.drawing.draw();
  }

  cancelReveal(): void {
    const win = this.parts.win;
    if (this.revealFrame && win) {
      if (this.revealFrameKind === 'animation' && typeof win.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(this.revealFrame);
      } else if (this.revealFrameKind === 'timeout' && typeof win.clearTimeout === 'function') {
        win.clearTimeout(this.revealFrame);
      }
    }
    this.revealFrame = 0;
    this.revealFrameKind = '';
  }

  // Lines the footer's hints up with the menu items' icons.
  alignFooter(): void {
    const { menu, content, footer } = this.parts;
    if (!this.state.open) {
      return;
    }
    const firstIcon = queryHtmlElement(content, '.x-lumno-search-input-mode__menu-icon');
    if (!firstIcon || Number(firstIcon.offsetWidth) <= 0) {
      return;
    }
    const menuRect = menu.getBoundingClientRect();
    const menuLayoutWidth = Number(menu.offsetWidth) || menuRect.width;
    const scaleX = menuLayoutWidth > 0 ? menuRect.width / menuLayoutWidth : 1;
    if (!Number.isFinite(scaleX) || scaleX <= 0) {
      return;
    }
    const inlineStart = Math.max(0, (firstIcon.getBoundingClientRect().left - footer.getBoundingClientRect().left) / scaleX);
    setStyle(footer, '--x-lumno-search-mode-footer-inline-start', `${Math.round(inlineStart * 100) / 100}px`);
  }

  private requestFrame(callback: () => void): number {
    const win = this.parts.win;
    if (win && typeof win.requestAnimationFrame === 'function') {
      return win.requestAnimationFrame(callback);
    }
    if (win && typeof win.setTimeout === 'function') {
      return win.setTimeout(callback, 0);
    }
    callback();
    return 0;
  }

  private requestRevealFrame(callback: () => void): void {
    this.cancelReveal();
    let completedSynchronously = false;
    const frame = this.requestFrame(() => {
      completedSynchronously = true;
      this.revealFrame = 0;
      this.revealFrameKind = '';
      callback();
    });
    if (!completedSynchronously) {
      const win = this.parts.win;
      this.revealFrame = frame;
      this.revealFrameKind = win && typeof win.requestAnimationFrame === 'function' ? 'animation' : 'timeout';
    }
  }
}

export type { FitModeMenuOptions, ModeMenuLayoutChange, ModeMenuSurfaceParts, ModeMenuSurfaceWindow };
export { ModeMenuSurface };
