// The wordmark's or clock's drawn content, and the part of it the
// wallpaper's tone is read under.
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

// The wordmark's or clock's drawn content; null before it is drawn.
function getWordmarkContent(container: HTMLElement): HTMLElement | null {
  return queryHtmlElement(container, '.x-nt-wordmark-content');
}

function getTopContentSample(container: HTMLElement): HTMLElement {
  return getWordmarkContent(container) || container;
}

// The wordmark's link button and image; null while the clock shows.
function getWordmarkButton(container: HTMLElement): HTMLButtonElement | null {
  return queryHtmlTag(container, 'button', 'button');
}

function getWordmarkImage(container: HTMLElement): HTMLImageElement | null {
  return queryHtmlTag(container, 'img', 'img');
}

export { getTopContentSample, getWordmarkButton, getWordmarkContent, getWordmarkImage };
