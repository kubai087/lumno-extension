// Where the pointer is, whether a target is still under it or focused, and
// placing the cursor tooltip beside the pointer.
import * as LumnoTooltip from './tooltip';
import { getElementRect, getNumber, placeTooltipAt, prepareTooltipFrame } from './tooltip-frame';

import type { CursorPoint, CursorPointInput, CursorTooltipControllerOptions, CursorTooltipOptions, CursorTooltipPosition, CursorTooltipWindow, HandoffNode } from './cursor-tooltip-model';

// The global timers with the DOM's numeric ids.
function getDocument(options: CursorTooltipOptions | null | undefined): Document | null {
  return (options && options.documentObj) || globalThis.document || null;
}

function getWindow(options: CursorTooltipOptions | null | undefined): CursorTooltipWindow {
  return (options && options.windowObj) || globalThis;
}


function getExplicitPointFromInput(input: CursorPointInput | null | undefined): CursorPoint | null {
  const source: CursorPointInput = input || {};
  const x = Number(source.clientX !== undefined ? source.clientX : source.x);
  const y = Number(source.clientY !== undefined ? source.clientY : source.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { clientX: x, clientY: y };
  }
  return null;
}

// The input's point, or the middle of the target's bottom edge without one.
function getPointFromInput(input: CursorPointInput | null | undefined, target: Element | null | undefined): CursorPoint {
  const point = getExplicitPointFromInput(input);
  if (point) {
    return point;
  }
  const rect = getElementRect(target);
  return {
    clientX: rect.left + ((rect.width || 0) / 2),
    clientY: rect.bottom || (rect.top + (rect.height || 0))
  };
}

function isPointInsideElement(point: CursorPoint | null, element: Element | null): boolean {
  if (!point || !element) {
    return false;
  }
  const rect = getElementRect(element);
  return point.clientX >= rect.left &&
    point.clientX <= rect.right &&
    point.clientY >= rect.top &&
    point.clientY <= rect.bottom;
}

function isSamePoint(point: CursorPoint | null, referencePoint: CursorPoint | null): boolean {
  if (!point || !referencePoint) {
    return false;
  }
  return Math.abs(point.clientX - referencePoint.clientX) <= 1 &&
    Math.abs(point.clientY - referencePoint.clientY) <= 1;
}

function isTargetActive(target: HTMLElement | null, doc: Document | null, options: CursorTooltipOptions): boolean {
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

function shouldShowTarget(target: HTMLElement, options: CursorTooltipOptions): boolean {
  if (typeof options.shouldShow !== 'function') {
    return true;
  }
  try {
    return options.shouldShow(target, options.inputEvent || null) !== false;
  } catch (_error) {
    return false;
  }
}

function createElement(doc: Document | null, options: CursorTooltipControllerOptions, tooltipKind?: string): HTMLElement | null {
  return LumnoTooltip.createElement(doc, { ...options, tooltipKind: tooltipKind || 'cursor' });
}


// Places the tooltip below and to the right of the point, flipped to the
// other side when it would leave the viewport or the boundary element.
function positionAtPoint(
  element: HTMLElement | null | undefined,
  point: CursorPointInput | null | undefined,
  options?: CursorTooltipOptions | null
): Readonly<CursorTooltipPosition> | null {
  if (!element || !point) {
    return null;
  }
  const config: CursorTooltipOptions = options || {};
  const frame = prepareTooltipFrame(element, config, getWindow(config));
  const offsetX = getNumber(config.offsetX, 14);
  const offsetY = getNumber(config.offsetY, 16);
  const tooltipRect = getElementRect(element);
  const pointerLeft = getNumber(point.clientX !== undefined ? point.clientX : point.x, 0) - frame.boundaryRect.left;
  const pointerTop = getNumber(point.clientY !== undefined ? point.clientY : point.y, 0) - frame.boundaryRect.top;
  const left = pointerLeft + offsetX;
  const top = pointerTop + offsetY;
  return placeTooltipAt(element, frame, tooltipRect, {
    top: top + tooltipRect.height + frame.margin > frame.height ? pointerTop - tooltipRect.height - offsetY : top,
    left: left + tooltipRect.width + frame.margin > frame.width ? pointerLeft - tooltipRect.width - offsetX : left
  });
}

function isHandoffNode(value: unknown): value is HandoffNode {
  return typeof value === 'object' && value !== null && ('parentNode' in value || 'getAttribute' in value);
}

function getNodeParent(node: HandoffNode | null | undefined): HandoffNode | null {
  return (node && (node.parentElement || node.parentNode)) || null;
}

function isNodeContainedBy(container: HandoffNode, node: HandoffNode): boolean {
  let current: HandoffNode | null = node;
  while (current) {
    if (current === container) {
      return true;
    }
    current = getNodeParent(current);
  }
  return false;
}

// The nearest bound target at or above the node, below the root.
function getBoundHandoffTarget(node: HandoffNode, boundAttribute: string, rootNode: HandoffNode): HandoffNode | null {
  let current: HandoffNode | null = node;
  while (current && current !== rootNode) {
    if (typeof current.getAttribute === 'function' && current.getAttribute(boundAttribute) === 'true') {
      return current;
    }
    current = getNodeParent(current);
  }
  return null;
}

function isModifierRefreshEvent(event: CursorPointInput | null | undefined): boolean {
  if (!event) {
    return false;
  }
  const key = String(event.key || '');
  return Boolean(
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    key === 'Meta' ||
    key === 'Control' ||
    key === 'Alt' ||
    key === 'Shift'
  );
}

export {
  createElement,
  getBoundHandoffTarget,
  getDocument,
  getExplicitPointFromInput,
  getNodeParent,
  getPointFromInput,
  getWindow,
  isHandoffNode,
  isModifierRefreshEvent,
  isNodeContainedBy,
  isPointInsideElement,
  isSamePoint,
  isTargetActive,
  positionAtPoint,
  shouldShowTarget
};
