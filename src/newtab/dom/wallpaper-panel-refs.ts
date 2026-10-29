// The appearance panel's elements by their data-wallpaper-ref names, for the
// parts other runtimes fill in, focus or measure.
import { queryHtmlElement, queryHtmlElements, queryHtmlTag } from '../../shared/dom-lookup';

function getWallpaperPanelRef(control: HTMLElement, name: string): HTMLElement | null {
  return queryHtmlElement(control, `[data-wallpaper-ref="${name}"]`);
}

function getWallpaperPanelRefTag<K extends keyof HTMLElementTagNameMap>(
  control: HTMLElement,
  name: string,
  tag: K
): HTMLElementTagNameMap[K] | null {
  return queryHtmlTag(control, `[data-wallpaper-ref="${name}"]`, tag);
}

function getWallpaperPanelRefs(control: HTMLElement): Record<string, HTMLElement> {
  const refs: Record<string, HTMLElement> = {};
  queryHtmlElements(control, '[data-wallpaper-ref]').forEach((element) => {
    const name = element.dataset.wallpaperRef;
    if (name) {
      refs[name] = element;
    }
  });
  return refs;
}

export { getWallpaperPanelRef, getWallpaperPanelRefTag, getWallpaperPanelRefs };
