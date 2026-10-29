// What the cursor tooltip shows: its element and tag, which target it is
// showing for, where the pointer was, and the delayed hide. It knows
// nothing of bound targets; the controller decides when to show and hide.
import * as LumnoTooltip from './tooltip';
import { getClearTimeout, getNumber, getRequestAnimationFrame, getSetTimeout } from './tooltip-frame';
import { DEFAULT_VISIBLE_ATTRIBUTE } from './cursor-tooltip-model';
import type { CursorPoint, CursorPointInput, CursorTooltipControllerOptions, CursorTooltipOptions, CursorTooltipWindow } from './cursor-tooltip-model';
import {
  createElement,
  getDocument,
  getExplicitPointFromInput,
  getPointFromInput,
  getWindow,
  isPointInsideElement,
  isSamePoint,
  isTargetActive,
  positionAtPoint,
  shouldShowTarget
} from './cursor-tooltip-points';
import { createCursorTag, getCursorTooltipTagText } from './cursor-tooltip-tag';
import type { CursorTag } from './cursor-tooltip-tag';

interface CursorSurface {
  ensureElement(): HTMLElement | null;
  ensureTagElement(): HTMLElement | null;
  readonly documentObj: Document | null;
  currentTarget(): HTMLElement | null;
  lastPoint(): CursorPoint | null;
  show(
    target: HTMLElement | null | undefined,
    text: string | null | undefined,
    pointInput?: CursorPointInput | null,
    showOptions?: CursorTooltipOptions | null
  ): HTMLElement | null;
  // Follows the pointer; hides through `hide` when the target no longer wants it.
  move(pointInput: CursorPointInput | null | undefined, moveOptions: CursorTooltipOptions | null | undefined, hide: () => void): HTMLElement | null;
  // deferVisibility keeps the tooltip up for the hide delay, so a move to
  // the next bound target does not blink it.
  hide(deferVisibility: boolean): HTMLElement | null;
  // Swaps the shown text in place, for a target whose text depends on where
  // the pointer is on it.
  retext(text: string): void;
  // A pointerenter where the pointer already was (the page re-rendered under
  // it) keeps the current target; true when this one is such an enter.
  keepForStaleEnter(event: CursorPointInput | null | undefined, target: HTMLElement): boolean;
  destroy(): void;
}

function setShown(element: HTMLElement, shown: boolean): void {
  element.setAttribute(DEFAULT_VISIBLE_ATTRIBUTE, shown ? 'true' : 'false');
  element.setAttribute('aria-hidden', shown ? 'false' : 'true');
}

// Orders the tooltip's shows and hides: each starts a new turn, and a frame
// or timer left from an earlier turn does nothing.
interface Turns {
  // Starts a turn, dropping any pending hide.
  next(): number;
  inNextFrame(turn: number, run: () => void): void;
  afterHideDelay(turn: number, run: () => void): void;
  // Drops a pending hide, so what shows stays.
  keepShowing(): void;
}

function createTurns(windowObj: CursorTooltipWindow, hideDelay: number): Turns {
  const requestFrame = getRequestAnimationFrame(windowObj);
  const setTimer = getSetTimeout(windowObj);
  const clearTimer = getClearTimeout(windowObj);
  let turn = 0;
  let hideTimer: number | null = null;
  const cancelHide = (): void => {
    if (hideTimer) {
      clearTimer(hideTimer);
      hideTimer = null;
    }
  };
  return {
    next() {
      cancelHide();
      turn += 1;
      return turn;
    },
    inNextFrame(startedTurn, run) {
      requestFrame(() => {
        if (startedTurn === turn) {
          run();
        }
      });
    },
    afterHideDelay(startedTurn, run) {
      hideTimer = setTimer(() => {
        if (startedTurn === turn) {
          hideTimer = null;
          run();
        }
      }, hideDelay);
    },
    keepShowing() {
      if (hideTimer) {
        cancelHide();
        turn += 1;
      }
    }
  };
}

// The tooltip's and the tag's elements, made on first use, and drawing
// them beside the pointer.
interface CursorDrawing {
  tag: CursorTag;
  element(): HTMLElement | null;
  ensureElement(): HTMLElement | null;
  renderTag(target: HTMLElement, pointInput: CursorPointInput | null | undefined, options: CursorTooltipOptions): HTMLElement | null;
  // Places the tooltip beside the point and the tag above it.
  placeAtPoint(tagElement: HTMLElement | null, point: CursorPoint, options: CursorTooltipOptions): void;
  // Shows the tooltip and, when drawn, its tag.
  reveal(tagElement: HTMLElement | null): void;
  revealTag(tagElement: HTMLElement | null): void;
  destroy(): void;
}

function createCursorDrawing(config: CursorTooltipControllerOptions, documentObj: Document | null): CursorDrawing {
  const appendToPage = (node: HTMLElement): void => {
    const appendTo = config.appendTo || (documentObj && documentObj.body);
    if (appendTo) {
      appendTo.appendChild(node);
    }
  };
  const tag = createCursorTag(documentObj, config, appendToPage);
  let element: HTMLElement | null = null;
  const ensureElement = (): HTMLElement | null => {
    if (!element) {
      element = createElement(documentObj, config);
      if (element) {
        appendToPage(element);
      }
    }
    return element;
  };
  return {
    tag,
    element: () => element,
    ensureElement,
    renderTag: (target, pointInput, options) => (
      tag.render(element, getCursorTooltipTagText(target, pointInput, options), options)
    ),
    placeAtPoint(tagElement, point, options) {
      const tooltipPosition = element ? positionAtPoint(element, point, options) : null;
      if (tagElement && tooltipPosition) {
        tag.place(tagElement, tooltipPosition, options);
      }
    },
    reveal(tagElement) {
      if (element) {
        setShown(element, true);
      }
      if (tagElement) {
        tag.setVisible(true);
      }
    },
    revealTag(tagElement) {
      if (tagElement) {
        tag.setVisible(true);
      }
    },
    destroy() {
      if (element) {
        LumnoTooltip.removeTooltipElement(element);
      }
      element = null;
      tag.destroy();
    }
  };
}

// An enter at the point the pointer already was, or still inside the
// current target.
function isStaleEnter(event: CursorPointInput | null | undefined, lastPoint: CursorPoint | null, currentTarget: HTMLElement | null): boolean {
  const point = getExplicitPointFromInput(event);
  return isSamePoint(point, lastPoint) || isPointInsideElement(point, currentTarget);
}

function withInput(
  config: CursorTooltipOptions,
  options: CursorTooltipOptions | null | undefined,
  pointInput: CursorPointInput | null | undefined
): CursorTooltipOptions {
  return { ...config, ...options, inputEvent: pointInput || null };
}

// Hides the tooltip, at once or after the hide delay; `onConceal` runs as
// it goes.
function hideDrawing(drawing: CursorDrawing, turns: Turns, deferVisibility: boolean, onConceal: () => void): HTMLElement | null {
  const tooltip = drawing.element();
  drawing.tag.hide(tooltip);
  if (!tooltip) {
    return null;
  }
  const turn = turns.next();
  const conceal = (element: HTMLElement): void => {
    onConceal();
    setShown(element, false);
  };
  if (!deferVisibility) {
    conceal(tooltip);
  }
  turns.afterHideDelay(turn, () => {
    const element = drawing.element();
    if (element && deferVisibility) {
      conceal(element);
    } else if (element) {
      element.setAttribute(DEFAULT_VISIBLE_ATTRIBUTE, 'false');
    }
  });
  return tooltip;
}

function createCursorSurface(config: CursorTooltipControllerOptions): CursorSurface {
  const documentObj = getDocument(config);
  const windowObj = getWindow(config);
  const turns = createTurns(windowObj, getNumber(config.hideDelay, 120));
  const drawing = createCursorDrawing(config, documentObj);
  let currentTarget: HTMLElement | null = null;
  let currentText = '';
  let lastPoint: CursorPoint | null = null;

  function show(
    target: HTMLElement | null | undefined,
    text: string | null | undefined,
    pointInput?: CursorPointInput | null,
    showOptions?: CursorTooltipOptions | null
  ): HTMLElement | null {
    const content = String(text || '');
    const options = withInput(config, showOptions, pointInput);
    const tooltip = target && content && shouldShowTarget(target, options) ? drawing.ensureElement() : null;
    if (!target || !tooltip) {
      return null;
    }
    const turn = turns.next();
    currentTarget = target;
    currentText = content;
    lastPoint = getPointFromInput(pointInput, target);
    LumnoTooltip.renderText(tooltip, content);
    const preserveVisible = Boolean(options.preserveVisibleOnTargetSwitch) &&
      tooltip.getAttribute(DEFAULT_VISIBLE_ATTRIBUTE) === 'true';
    const tagElement = drawing.renderTag(target, pointInput, options);
    setShown(tooltip, preserveVisible);
    drawing.placeAtPoint(tagElement, lastPoint, options);
    turns.inNextFrame(turn, () => {
      if (currentTarget !== target || !isTargetActive(target, documentObj, options)) {
        return;
      }
      drawing.reveal(tagElement);
    });
    return tooltip;
  }

  function move(pointInput: CursorPointInput | null | undefined, moveOptions: CursorTooltipOptions | null | undefined, hide: () => void): HTMLElement | null {
    const element = drawing.element();
    if (!element || !currentTarget) {
      return null;
    }
    lastPoint = getPointFromInput(pointInput, currentTarget);
    const options = withInput(config, moveOptions, pointInput);
    if (!shouldShowTarget(currentTarget, options)) {
      hide();
      return element;
    }
    const tagElement = drawing.renderTag(currentTarget, pointInput, options);
    drawing.placeAtPoint(tagElement, lastPoint, options);
    drawing.revealTag(tagElement);
    return element;
  }

  function hide(deferVisibility: boolean): HTMLElement | null {
    return hideDrawing(drawing, turns, deferVisibility, () => {
      currentTarget = null;
    });
  }

  return {
    ensureElement: drawing.ensureElement,
    ensureTagElement: () => drawing.tag.ensureElement(),
    documentObj,
    currentTarget: () => currentTarget,
    lastPoint: () => lastPoint,
    show,
    move,
    hide,
    retext(text) {
      const element = drawing.element();
      if (element && text !== currentText) {
        currentText = text;
        LumnoTooltip.renderText(element, text);
      }
    },
    keepForStaleEnter(event, target) {
      const staleEnter = Boolean(currentTarget) && currentTarget !== target && isStaleEnter(event, lastPoint, currentTarget);
      if (staleEnter) {
        turns.keepShowing();
      }
      return staleEnter;
    },
    destroy() {
      turns.next();
      currentTarget = null;
      drawing.destroy();
    }
  };
}

export type { CursorSurface };
export { createCursorSurface };
