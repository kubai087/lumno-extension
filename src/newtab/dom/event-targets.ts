// What a pointer or key event landed on, for the views' handlers.
import { isElementNode } from '../../shared/dom-guards';

// The button a pointer is over, from the node it entered.
function getButtonAtTarget(target: EventTarget | null): HTMLButtonElement | null {
  const button = isElementNode(target) ? target.closest('button') : null;
  return button instanceof HTMLButtonElement ? button : null;
}

// Whether a press began on a wallpaper tile's delete button.
function isWallpaperDeleteTarget(target: EventTarget | null): boolean {
  return isElementNode(target) && Boolean(target.closest('.x-nt-wallpaper-delete-button'));
}

// The row a range slider sits in.
function getRangeSliderRow(input: Element): Element | null {
  return input.closest('.x-nt-range-slider-row');
}

export { getButtonAtTarget, getRangeSliderRow, isWallpaperDeleteTarget };
