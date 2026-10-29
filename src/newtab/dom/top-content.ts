// The part of the wordmark or clock the wallpaper's tone is read under.
import { queryHtmlElement } from '../../shared/dom-lookup';

function getTopContentSample(container: HTMLElement): HTMLElement {
  return queryHtmlElement(container, '.x-nt-wordmark-content') || container;
}

export { getTopContentSample };
