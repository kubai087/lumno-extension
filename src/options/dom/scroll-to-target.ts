// Settings a link can point at inside a tab, as "#tab:target": the row
// scrolls into view, and flashes once when the link asks.
interface ScrollToTargetOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  // Flash the row once it is in view.
  flash?: boolean;
}

const TARGET_ELEMENT_IDS: Readonly<Record<string, string>> = Object.freeze({
  'document-pip': '_x_extension_document_pip_row_2026_unique_',
  'site-search-ai': '_x_extension_site_search_ai_group_2026_unique_'
});

// Points the eye at the row a deep link opened, e.g. the web clip switch
// that the toolbar button leads to while web clip is off.
function flashTarget(target: Element): void {
  target.removeAttribute('data-flash');
  // Reading the layout restarts the animation when the attribute returns.
  void target.getBoundingClientRect();
  target.setAttribute('data-flash', 'true');
  const onFlashEnd = () => {
    target.removeAttribute('data-flash');
    target.removeEventListener('animationend', onFlashEnd);
  };
  target.addEventListener('animationend', onFlashEnd);
}

// Whether the target is on the page to scroll to; it scrolls in the next frame.
function scrollToTarget(doc: Document, win: Window, targetKey: string, options: ScrollToTargetOptions = {}): boolean {
  const id = Object.prototype.hasOwnProperty.call(TARGET_ELEMENT_IDS, targetKey) ? TARGET_ELEMENT_IDS[targetKey] : '';
  const target = id ? doc.getElementById(id) : null;
  if (!target) {
    return false;
  }
  win.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: options.behavior || 'smooth', block: options.block || 'start' });
    if (options.flash) {
      flashTarget(target);
    }
  });
  return true;
}

export { scrollToTarget };
export type { ScrollToTargetOptions };
