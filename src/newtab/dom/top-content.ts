// The wordmark's or clock's drawn content, and the part of it the
// wallpaper's tone is read under.
import { queryHtmlElement } from '../../shared/dom-lookup';

// The wordmark's or clock's drawn content; null before it is drawn.
function getWordmarkContent(container: HTMLElement): HTMLElement | null {
  return queryHtmlElement(container, '.x-nt-wordmark-content');
}

function getTopContentSample(container: HTMLElement): HTMLElement {
  return getWordmarkContent(container) || container;
}

export { getTopContentSample, getWordmarkContent };
