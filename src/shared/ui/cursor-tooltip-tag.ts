// The tag above the cursor tooltip that names what a held modifier key
// would do. It has its own element, made on first use, and sits just above
// the tooltip's left edge.
import { getElementRect, getNumber, placeTooltipAt, prepareTooltipFrame } from './tooltip-frame';
import { renderCursorTag } from '../react/tooltip-view';
import { removeTooltipElement } from './tooltip';
import { DEFAULT_VISIBLE_ATTRIBUTE, TAG_CLASS } from './cursor-tooltip-model';
import type { CursorPointInput, CursorTooltipControllerOptions, CursorTooltipOptions, CursorTooltipPosition } from './cursor-tooltip-model';
import { createElement, getWindow } from './cursor-tooltip-points';

interface CursorTag {
  // The tag's element, made and added to the page on first use.
  ensureElement(): HTMLElement | null;
  // Draws the tag for the text, hidden until setVisible; null without text.
  render(tooltip: HTMLElement | null, text: string, options: CursorTooltipOptions): HTMLElement | null;
  place(tag: HTMLElement, tooltipPosition: Readonly<CursorTooltipPosition>, options: CursorTooltipOptions): void;
  setVisible(visible: boolean): void;
  hide(tooltip: HTMLElement | null): void;
  destroy(): void;
}

const TAG_WIDTH_LIMITS = { minWidth: 120, defaultMaxWidth: 220 };

function isMacPlatform(options: CursorTooltipOptions): boolean {
  const navigatorObj = getWindow(options).navigator || globalThis.navigator || {};
  const source = `${navigatorObj.platform || ''} ${navigatorObj.userAgent || ''}`.toLowerCase();
  return /mac|iphone|ipad|ipod/.test(source);
}

function getCursorTooltipTagKeyText(options: CursorTooltipOptions): string {
  if (typeof options.getTagKeyText === 'function') {
    return String(options.getTagKeyText(options) || '').trim();
  }
  if (options.tagKeyText !== undefined && options.tagKeyText !== null) {
    return String(options.tagKeyText || '').trim();
  }
  return isMacPlatform(options) ? '⌘' : 'win';
}

function getCursorTooltipTagText(target: HTMLElement, pointInput: CursorPointInput | null | undefined, options: CursorTooltipOptions): string {
  if (typeof options.getTagText === 'function') {
    return String(options.getTagText(pointInput || {}, target) || '').trim();
  }
  return String(options.tagText || '').trim();
}

function setShown(element: HTMLElement, shown: boolean): void {
  element.setAttribute(DEFAULT_VISIBLE_ATTRIBUTE, shown ? 'true' : 'false');
  element.setAttribute('aria-hidden', shown ? 'false' : 'true');
}

function drawTag(tag: HTMLElement, text: string, options: CursorTooltipOptions): HTMLElement | null {
  const keyText = getCursorTooltipTagKeyText(options);
  renderCursorTag(tag, {
    keyText,
    label: text,
    windowsLogo: keyText.toLowerCase() === 'win'
  });
  tag.setAttribute('aria-label', `${keyText} ${text}`.trim());
  setShown(tag, false);
  return tag;
}

function createCursorTag(
  documentObj: Document | null,
  config: CursorTooltipControllerOptions,
  appendToPage: (node: HTMLElement) => void
): CursorTag {
  let tagElement: HTMLElement | null = null;

  function ensureElement(): HTMLElement | null {
    if (tagElement) {
      return tagElement;
    }
    tagElement = createElement(documentObj, {
      ...config,
      id: config.id ? `${config.id}_tag` : '',
      className: [config.className, TAG_CLASS].filter(Boolean).join(' ')
    }, 'cursor-tag');
    if (tagElement) {
      tagElement.setAttribute('data-cursor-tooltip-tag', 'true');
      appendToPage(tagElement);
    }
    return tagElement;
  }

  function hide(tooltip: HTMLElement | null): void {
    if (tooltip) {
      tooltip.setAttribute('data-cursor-tooltip-tag-visible', 'false');
    }
    if (tagElement) {
      setShown(tagElement, false);
    }
  }

  return {
    ensureElement,
    render(tooltip, tagText, options) {
      const text = String(tagText || '').trim();
      if (!text) {
        hide(tooltip);
        return null;
      }
      if (tooltip) {
        tooltip.setAttribute('data-cursor-tooltip-tag-visible', 'true');
      }
      const tag = ensureElement();
      return tag ? drawTag(tag, text, { ...config, ...options }) : null;
    },
    place(tag, tooltipPosition, options) {
      const frame = prepareTooltipFrame(tag, { ...options, maxWidth: options.tagMaxWidth }, getWindow(config), TAG_WIDTH_LIMITS);
      const tagRect = getElementRect(tag);
      placeTooltipAt(tag, frame, tagRect, {
        left: tooltipPosition.left,
        top: tooltipPosition.top - tagRect.height - getNumber(options.tagGap, 6)
      });
    },
    setVisible(visible) {
      if (tagElement) {
        setShown(tagElement, visible);
      }
    },
    hide,
    destroy() {
      if (tagElement) {
        removeTooltipElement(tagElement);
      }
      tagElement = null;
    }
  };
}

export type { CursorTag };
export { createCursorTag, getCursorTooltipTagText };
