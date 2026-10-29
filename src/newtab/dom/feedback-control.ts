// The feedback control's host element, and the button drawn in it.
import { queryHtmlElement } from '../../shared/dom-lookup';

function createFeedbackControlHost(doc: Document): HTMLDivElement {
  return doc.createElement('div');
}

function getFeedbackButtonElement(control: HTMLElement): HTMLElement | null {
  return queryHtmlElement(control, '.x-nt-feedback-button');
}

export { createFeedbackControlHost, getFeedbackButtonElement };
