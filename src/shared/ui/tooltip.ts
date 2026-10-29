import { queryHtmlElements } from '../dom-lookup';
import { createTooltipElement, destroyTooltipElement, renderTooltipText } from '../react/tooltip-view';
import { getClearTimeout, getElementRect, getNumber, getRequestAnimationFrame, getSetTimeout, placeTooltipAt, prepareTooltipFrame } from './tooltip-frame';
import type { TooltipPosition, TooltipRect, TooltipWindow } from './tooltip-frame';
import type { PortalHost } from '../react/portal-host';
// The shared tooltip: one element per controller, placed beside its target
// and drawn by the React tooltip view (tooltip-view.tsx).
const TOOLTIP_CLASS = '_x_extension_tooltip_2026_unique_';
const HOST_CLASS = '_x_extension_tooltip_host_2026_unique_';
const LEGACY_HOST_CLASS = '_x_extension_tooltip_host_2024_unique_';
const LINE_CLASS = '_x_extension_tooltip_line_2026_unique_';
const DIVIDER_CLASS = '_x_extension_tooltip_divider_2026_unique_';
const DEFAULT_VISIBLE_ATTRIBUTE = 'data-visible';
const DEFAULT_BOUND_ATTRIBUTE = 'data-tooltip-bound';
const DEFAULT_TEXT_ATTRIBUTE = 'data-tooltip';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'left-above';

interface TooltipElementOptions {
  documentObj?: Document | null;
  className?: string;
  id?: string;
  tooltipKind?: string;
  // 'absolute' places the tooltip inside boundaryElement; anything else is fixed.
  positionMode?: string;
  decorateElement?(element: HTMLElement): void;
}

interface TooltipPositionOptions {
  windowObj?: TooltipWindow | null;
  positionMode?: string;
  placement?: TooltipPlacement | string;
  margin?: number;
  // The gap to the target; a function reads it per target.
  spacing?: number | ((target: HTMLElement) => number);
  boundaryElement?: Element | null;
  maxWidth?: number | string;
}

interface TooltipActiveOptions {
  // false shows the tooltip even when the target is neither focused nor hovered.
  checkActive?: boolean;
}

type TooltipShowOptions = TooltipPositionOptions & TooltipActiveOptions;

interface TooltipBindOptions extends TooltipShowOptions {
  boundAttribute?: string;
  // Keep the native title tooltip as well.
  suppressNativeTitle?: boolean;
  // The attribute that holds the text, data-tooltip by default.
  attributeName?: string;
  showOnFocus?: boolean;
  selector?: string;
}

// What a tooltip is drawn with: the surface's React root.
interface TooltipDrawing {
  portals: PortalHost;
}

interface TooltipControllerOptions extends TooltipElementOptions, TooltipShowOptions, TooltipDrawing {
  appendTo?: Node | null;
  hideDelay?: number;
}

type TooltipTextSource = (target: HTMLElement) => string | null | undefined;

interface TooltipController {
  readonly element: HTMLElement | null;
  destroy(): void;
  show(target: HTMLElement | null | undefined, text: string | null | undefined, options?: TooltipShowOptions | null): HTMLElement | null;
  hide(): HTMLElement | null;
  bind(target: HTMLElement | null | undefined, getText?: TooltipTextSource | null, options?: TooltipBindOptions | null): HTMLElement | null;
  bindAll(rootNode?: ParentNode | null, options?: TooltipBindOptions | null): HTMLElement[];
}

// The global timers with the DOM's numeric ids.
function getDocument(options: TooltipElementOptions | null | undefined): Document | null {
  return (options && options.documentObj) || globalThis.document || null;
}

function getWindow(options: TooltipPositionOptions | null | undefined): TooltipWindow {
  return (options && options.windowObj) || globalThis;
}

function getDynamicNumber(
  value: number | ((target: HTMLElement) => number) | undefined,
  target: HTMLElement,
  fallback: number
): number {
  const resolved = typeof value === 'function' ? value(target) : value;
  return getNumber(resolved, fallback);
}

function createElement(doc: Document | null | undefined, options: TooltipElementOptions & TooltipDrawing): HTMLElement | null {
  const documentObj = doc || getDocument(options);
  if (!documentObj) {
    return null;
  }
  const config = options;
  const element = createTooltipElement({
    portals: config.portals,
    className: config.className || '',
    documentObj,
    id: config.id ? String(config.id) : '',
    kind: config.tooltipKind || '',
    positionMode: config.positionMode
  });
  if (element && typeof config.decorateElement === 'function') {
    config.decorateElement(element);
  }
  return element;
}

function renderText(element: HTMLElement | null | undefined, text: string | null | undefined): HTMLElement | null {
  if (!element) {
    return null;
  }
  renderTooltipText(element, String(text || ''));
  return element;
}

function isTargetActive(target: HTMLElement | null, doc: Document | null, options: TooltipActiveOptions): boolean {
  if (options.checkActive === false) {
    return true;
  }
  if (!target) {
    return false;
  }
  if (target.isConnected === false) {
    return false;
  }
  if (doc && doc.activeElement === target) {
    return true;
  }
  try {
    return target.matches(':hover');
  } catch (_error) {
    return true;
  }
}

function readPlacement(value: string | undefined): TooltipPlacement {
  return value === 'left' || value === 'left-above' || value === 'bottom' ? value : 'top';
}

// Where the target and the tooltip sit, relative to the boundary.
interface PlacementBox {
  targetTop: number;
  targetBottom: number;
  targetLeft: number;
  targetRight: number;
  targetRect: TooltipRect;
  tooltipRect: TooltipRect;
  boundaryHeight: number;
  spacing: number;
  margin: number;
}

// The tooltip's place beside its target, flipped to the other side when the
// preferred side has no room.
function placeBesideTarget(placement: TooltipPlacement, box: PlacementBox): { top: number; left: number } {
  const { targetTop, targetBottom, targetLeft, targetRight, targetRect, tooltipRect, spacing, margin } = box;
  const centeredLeft = targetLeft + ((targetRect.width - tooltipRect.width) / 2);
  if (placement === 'left' || placement === 'left-above') {
    const left = targetLeft - tooltipRect.width - spacing;
    return {
      top: placement === 'left-above'
        ? targetTop - tooltipRect.height - spacing
        : targetTop + ((targetRect.height - tooltipRect.height) / 2),
      left: left < margin ? targetRight + spacing : left
    };
  }
  if (placement === 'bottom') {
    const top = targetBottom + spacing;
    return {
      top: top + tooltipRect.height + margin > box.boundaryHeight ? targetTop - tooltipRect.height - spacing : top,
      left: centeredLeft
    };
  }
  const top = targetTop - tooltipRect.height - spacing;
  return { top: top < margin ? targetBottom + spacing : top, left: centeredLeft };
}

// Places the tooltip above its target (or below, to the left, or above and to
// the left), flipped to the other side when it would leave the viewport or
// the boundary element, and clamped inside it.
function position(
  element: HTMLElement | null | undefined,
  target: HTMLElement | null | undefined,
  options?: TooltipPositionOptions | null
): Readonly<TooltipPosition> | null {
  if (!element || !target) {
    return null;
  }
  const config: TooltipPositionOptions = options || {};
  const frame = prepareTooltipFrame(element, config, getWindow(config));
  const { boundaryRect } = frame;
  const targetRect = getElementRect(target);
  const tooltipRect = getElementRect(element);
  const placed = placeBesideTarget(readPlacement(config.placement), {
    targetTop: targetRect.top - boundaryRect.top,
    targetBottom: targetRect.bottom - boundaryRect.top,
    targetLeft: targetRect.left - boundaryRect.left,
    targetRight: targetRect.right - boundaryRect.left,
    targetRect,
    tooltipRect,
    boundaryHeight: frame.height,
    spacing: getDynamicNumber(config.spacing, target, 10),
    margin: frame.margin
  });
  return placeTooltipAt(element, frame, tooltipRect, placed);
}

// Marks a target as bound, moving its native title aside so the browser's
// own tooltip does not show too. False when it was bound already.
function markBoundTarget(target: HTMLElement, settings: TooltipBindOptions): boolean {
  const boundAttribute = settings.boundAttribute || DEFAULT_BOUND_ATTRIBUTE;
  if (target.getAttribute(boundAttribute) === 'true') {
    return false;
  }
  target.classList.add(HOST_CLASS);
  target.classList.add(LEGACY_HOST_CLASS);
  target.setAttribute(boundAttribute, 'true');
  if (settings.suppressNativeTitle !== false) {
    const nativeTitle = target.getAttribute('title');
    if (nativeTitle) {
      target.setAttribute('data-tooltip-native-title', nativeTitle);
      target.removeAttribute('title');
    }
  }
  return true;
}

function setTooltipShown(tooltip: HTMLElement, shown: boolean): void {
  tooltip.setAttribute(DEFAULT_VISIBLE_ATTRIBUTE, shown ? 'true' : 'false');
  tooltip.setAttribute('aria-hidden', shown ? 'false' : 'true');
}

function removeTooltipElement(element: HTMLElement): void {
  destroyTooltipElement(element);
  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

// Binds every element under the scope that names its tooltip text.
function bindAllIn(
  scope: ParentNode | null | undefined,
  settings: TooltipBindOptions,
  bind: (target: HTMLElement, getText: null, bindOptions: TooltipBindOptions) => HTMLElement | null
): HTMLElement[] {
  if (!scope) {
    return [];
  }
  const selector = settings.selector || `[${settings.attributeName || DEFAULT_TEXT_ATTRIBUTE}]`;
  const bound: HTMLElement[] = [];
  queryHtmlElements(scope, selector).forEach((node) => {
    const result = bind(node, null, settings);
    if (result) {
      bound.push(result);
    }
  });
  return bound;
}

// Shows the tooltip while the pointer is over the target or it has focus.
function bindTarget(
  target: HTMLElement,
  getText: TooltipTextSource | null | undefined,
  settings: TooltipBindOptions,
  show: (target: HTMLElement, text: string | null | undefined, showOptions: TooltipShowOptions) => unknown,
  hide: () => unknown
): HTMLElement {
  if (!markBoundTarget(target, settings)) {
    return target;
  }
  const resolveText: TooltipTextSource = typeof getText === 'function'
    ? getText
    : () => target.getAttribute(settings.attributeName || DEFAULT_TEXT_ATTRIBUTE);
  const showBoundTooltip = (): void => {
    show(target, resolveText(target), settings);
  };
  target.addEventListener('mouseenter', showBoundTooltip);
  target.addEventListener('mouseleave', hide);
  if (settings.showOnFocus !== false) {
    target.addEventListener('focus', showBoundTooltip);
    target.addEventListener('blur', hide);
  }
  return target;
}

function createAttachedElement(documentObj: Document | null, config: TooltipControllerOptions): HTMLElement | null {
  const element = createElement(documentObj, config);
  const appendTo = config.appendTo || (documentObj && documentObj.body);
  if (appendTo && element) {
    appendTo.appendChild(element);
  }
  return element;
}

function createController(options: TooltipControllerOptions): TooltipController {
  const config = options;
  const documentObj = getDocument(config);
  const windowObj = getWindow(config);
  const requestFrame = getRequestAnimationFrame(windowObj);
  const setTimer = getSetTimeout(windowObj);
  const clearTimer = getClearTimeout(windowObj);
  let element: HTMLElement | null = null;
  let hideTimer: number | null = null;
  let currentTarget: HTMLElement | null = null;
  let token = 0;

  function ensureElement(): HTMLElement | null {
    element = element || createAttachedElement(documentObj, config);
    return element;
  }

  function cancelHideTimer(): void {
    if (hideTimer) {
      clearTimer(hideTimer);
      hideTimer = null;
    }
  }

  function show(
    target: HTMLElement | null | undefined,
    text: string | null | undefined,
    showOptions?: TooltipShowOptions | null
  ): HTMLElement | null {
    const content = String(text || '');
    if (!target || !content) {
      return null;
    }
    const tooltip = ensureElement();
    if (!tooltip) {
      return null;
    }
    cancelHideTimer();
    token += 1;
    const showToken = token;
    currentTarget = target;
    renderText(tooltip, content);
    setTooltipShown(tooltip, false);
    const mergedOptions: TooltipShowOptions = { ...config, ...showOptions };
    position(tooltip, target, mergedOptions);
    requestFrame(() => {
      if (showToken !== token || currentTarget !== target || !isTargetActive(target, documentObj, mergedOptions)) {
        return;
      }
      setTooltipShown(tooltip, true);
    });
    return tooltip;
  }

  function hide(): HTMLElement | null {
    const tooltip = element;
    if (!tooltip) {
      return null;
    }
    token += 1;
    const hideToken = token;
    currentTarget = null;
    setTooltipShown(tooltip, false);
    cancelHideTimer();
    hideTimer = setTimer(() => {
      if (hideToken !== token || !element) {
        return;
      }
      element.setAttribute(DEFAULT_VISIBLE_ATTRIBUTE, 'false');
      hideTimer = null;
    }, getNumber(config.hideDelay, 120));
    return tooltip;
  }

  function bind(
    target: HTMLElement | null | undefined,
    getText?: TooltipTextSource | null,
    bindOptions?: TooltipBindOptions | null
  ): HTMLElement | null {
    return target ? bindTarget(target, getText, bindOptions || {}, show, hide) : null;
  }

  return {
    get element() {
      return ensureElement();
    },
    destroy() {
      token += 1;
      currentTarget = null;
      cancelHideTimer();
      if (element) {
        removeTooltipElement(element);
      }
      element = null;
    },
    show,
    hide,
    bind,
    bindAll: (rootNode?: ParentNode | null, bindOptions?: TooltipBindOptions | null) => (
      bindAllIn(rootNode || documentObj, bindOptions || {}, bind)
    )
  };
}

export type {
  TooltipActiveOptions,
  TooltipBindOptions,
  TooltipController,
  TooltipControllerOptions,
  TooltipDrawing,
  TooltipElementOptions,
  TooltipPlacement,
  TooltipPositionOptions,
  TooltipShowOptions,
  TooltipTextSource
};
export {
  TOOLTIP_CLASS as className,
  HOST_CLASS as hostClassName,
  LINE_CLASS as lineClassName,
  DIVIDER_CLASS as dividerClassName,
  createElement,
  createController,
  removeTooltipElement,
  renderText,
  position
};
