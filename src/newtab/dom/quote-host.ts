// The quote line's host, hidden until a quote is shown; it moves between
// slots on the page with the chosen position.
import { queryHtmlElement } from '../../shared/dom-lookup';
function createQuoteHost(doc: Document): HTMLDivElement {
  const element = doc.createElement('div');
  element.className = 'x-nt-quote';
  element.hidden = true;
  return element;
}

// The quote line's text box, where the wallpaper's tone is sampled.
function getQuoteTextElement(host: HTMLElement): HTMLElement | null {
  return queryHtmlElement(host, '.x-nt-quote-line');
}

export { createQuoteHost, getQuoteTextElement };
