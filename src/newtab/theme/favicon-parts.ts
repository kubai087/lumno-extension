// The page's favicons: the data URLs already fetched, by icon URL, and the
// favicon view the page favicons module makes. The site theme
// resolver reads icon data through them and the appearance modes redraw the
// icons on a theme change; each part is null until it is mounted.
import type { FaviconViewRuntime } from '../dom/favicon-view';

class FaviconParts {
  // Icon data URLs by icon URL, shared by the view and the theme resolver.
  readonly dataCache = new Map<string, string>();
  private viewRuntime: FaviconViewRuntime | null = null;

  get view(): FaviconViewRuntime | null {
    return this.viewRuntime;
  }

  mount(view: FaviconViewRuntime): void {
    this.viewRuntime = view;
  }
}

export { FaviconParts };
