// The appearance panel's option buttons, and the part of one that moves (the
// button itself when it has no content of its own).
import { queryHtmlElement, queryHtmlElements } from '../../shared/dom-lookup';

function getAppearanceOptionButtons(options: HTMLElement): HTMLElement[] {
  return queryHtmlElements(options, '.x-nt-appearance-option');
}

function getAppearanceOptionMotionElement(button: HTMLElement): HTMLElement {
  return queryHtmlElement(button, '.x-nt-appearance-option-content') || button;
}

export { getAppearanceOptionButtons, getAppearanceOptionMotionElement };
