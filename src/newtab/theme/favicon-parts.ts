// The page's favicons: the data URLs already fetched, by icon URL, and the
// favicon cache and view the page favicons module makes. The site theme
// resolver reads icon data through them and the appearance modes redraw the
// icons on a theme change; each part is null until it is mounted.
import type { FaviconCacheRuntime } from '../../platform/favicon-cache';
import type { FaviconViewRuntime } from './favicon-view';

class FaviconParts {
  // Icon data URLs by icon URL, shared by the view and the theme resolver.
  readonly dataCache = new Map<string, string>();
  private cacheRuntime: FaviconCacheRuntime | null = null;
  private viewRuntime: FaviconViewRuntime | null = null;

  get cache(): FaviconCacheRuntime | null {
    return this.cacheRuntime;
  }

  get view(): FaviconViewRuntime | null {
    return this.viewRuntime;
  }

  mount(parts: { cache: FaviconCacheRuntime; view: FaviconViewRuntime }): void {
    this.cacheRuntime = parts.cache;
    this.viewRuntime = parts.view;
  }
}

export { FaviconParts };
