import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export const PAGE_STRUCTURE_IDS = Object.freeze({
  suggestionsContainer:
    '_x_extension_newtab_suggestions_container_2024_unique_',
  suggestionsSurface: '_x_extension_newtab_suggestions_surface_2026_unique_',
  suggestionsOutline: '_x_extension_newtab_suggestions_outline_2026_unique_',
  shortcutSection: '_x_extension_newtab_shortcuts_2026_unique_',
  bookmarkSection: '_x_extension_newtab_bookmarks_2024_unique_',
  bookmarkGrid: '_x_extension_newtab_bookmarks_grid_2024_unique_',
  recentSection: '_x_extension_newtab_recent_sites_2024_unique_',
  recentGrid: '_x_extension_newtab_recent_sites_grid_2024_unique_',
  searchLayer: '_x_extension_newtab_search_layer_2024_unique_'
});

interface ShortcutElements {
  grid: HTMLDivElement;
}

interface BookmarkElements {
  breadcrumb: HTMLDivElement;
  grid: HTMLDivElement;
  header: HTMLDivElement;
  heading: HTMLDivElement;
  managerButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  pager: HTMLDivElement;
  previousButton: HTMLButtonElement;
  titleWrap: HTMLDivElement;
}

interface RecentElements {
  grid: HTMLDivElement;
  header: HTMLDivElement;
  heading: HTMLDivElement;
}

function ShortcutStructure({
  register
}: {
  register(elements: ShortcutElements): void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (gridRef.current) {
      register({ grid: gridRef.current });
    }
  }, [register]);
  return <div className="x-nt-shortcuts-grid" ref={gridRef} />;
}

function BookmarkStructure({
  getRiSvg,
  register
}: {
  getRiSvg(icon: string, className: string): string;
  register(elements: BookmarkElements): void;
}) {
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const managerButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const titleWrapRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (
      breadcrumbRef.current &&
      gridRef.current &&
      headerRef.current &&
      headingRef.current &&
      managerButtonRef.current &&
      nextButtonRef.current &&
      pagerRef.current &&
      previousButtonRef.current &&
      titleWrapRef.current
    ) {
      register({
        breadcrumb: breadcrumbRef.current,
        grid: gridRef.current,
        header: headerRef.current,
        heading: headingRef.current,
        managerButton: managerButtonRef.current,
        nextButton: nextButtonRef.current,
        pager: pagerRef.current,
        previousButton: previousButtonRef.current,
        titleWrap: titleWrapRef.current
      });
    }
  }, [register]);
  return (
    <>
      <div className="x-nt-bookmarks-header" ref={headerRef}>
        <div className="x-nt-bookmarks-title-wrap" ref={titleWrapRef}>
          <div className="x-nt-bookmarks-heading" ref={headingRef} />
          <div
            className="x-nt-bookmarks-breadcrumb"
            ref={breadcrumbRef}
            style={{ display: 'none' }}
          />
        </div>
        <div className="x-nt-bookmarks-pager" ref={pagerRef}>
          <button
            className="x-nt-bookmarks-pager-btn"
            dangerouslySetInnerHTML={{
              __html: getRiSvg('ri-arrow-left-s-line', 'ri-size-16')
            }}
            ref={previousButtonRef}
            type="button"
          />
          <button
            className="x-nt-bookmarks-pager-btn"
            dangerouslySetInnerHTML={{
              __html: getRiSvg('ri-arrow-right-s-line', 'ri-size-16')
            }}
            ref={nextButtonRef}
            type="button"
          />
          {/* Firefox gives extensions no way to open its bookmarks Library. */}
          <button
            className="x-nt-bookmarks-pager-btn"
            dangerouslySetInnerHTML={{
              __html: getRiSvg('ri-bookmark-line', 'ri-size-16')
            }}
            data-browser-only="chromium"
            ref={managerButtonRef}
            type="button"
          />
        </div>
      </div>
      <div id={PAGE_STRUCTURE_IDS.bookmarkGrid} ref={gridRef} />
    </>
  );
}

function RecentStructure({
  register
}: {
  register(elements: RecentElements): void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (gridRef.current && headerRef.current && headingRef.current) {
      register({
        grid: gridRef.current,
        header: headerRef.current,
        heading: headingRef.current
      });
    }
  }, [register]);
  return (
    <>
      <div className="x-nt-recent-header-bar" ref={headerRef}>
        <div className="x-nt-recent-heading" ref={headingRef} />
      </div>
      <div id={PAGE_STRUCTURE_IDS.recentGrid} ref={gridRef} />
    </>
  );
}

function createHost<K extends keyof HTMLElementTagNameMap>(
  documentObj: Document,
  tagName: K,
  options: {
    className?: string;
    id: string;
    island: string;
    visible?: boolean;
  }
) {
  const host = documentObj.createElement(tagName);
  host.id = options.id;
  if (options.className) {
    host.className = options.className;
  }
  host.dataset.reactIsland = options.island;
  if (typeof options.visible === 'boolean') {
    host.dataset.visible = options.visible ? 'true' : 'false';
  }
  return host;
}

function renderStatic<T>(
  host: HTMLElement,
  render: (register: (elements: T) => void) => ReactNode
) {
  let elements: T | null = null;
  const register = (nextElements: T) => {
    elements = nextElements;
  };
  const root = createRoot(host);
  flushSync(() => root.render(render(register)));
  if (!elements) {
    flushSync(() => root.unmount());
    throw new Error('Lumno New Tab React page structure did not mount.');
  }
  return { elements: elements as T, root };
}

export interface PageStructureRuntime {
  bookmark: BookmarkElements & { section: HTMLElement };
  destroy(): void;
  recent: RecentElements & { section: HTMLElement };
  searchLayer: HTMLDivElement;
  shortcut: ShortcutElements & { section: HTMLElement };
  suggestions: {
    container: HTMLDivElement;
    outline: HTMLDivElement;
    surface: HTMLDivElement;
  };
}

export function createPageStructure(config: {
  documentObj?: Document;
  getRiSvg?(icon: string, className: string): string;
} = {}): PageStructureRuntime {
  const documentObj = config.documentObj || document;
  const getRiSvg =
    typeof config.getRiSvg === 'function' ? config.getRiSvg : () => '';
  const roots: Root[] = [];

  const shortcutSection = createHost(documentObj, 'section', {
    className: 'x-nt-shortcuts-section',
    id: PAGE_STRUCTURE_IDS.shortcutSection,
    island: 'newtab-shortcut-section'
  });
  const shortcutRender = renderStatic<ShortcutElements>(
    shortcutSection,
    (register) => <ShortcutStructure register={register} />
  );
  roots.push(shortcutRender.root);

  const bookmarkSection = createHost(documentObj, 'section', {
    id: PAGE_STRUCTURE_IDS.bookmarkSection,
    island: 'newtab-bookmark-section',
    visible: false
  });
  const bookmarkRender = renderStatic<BookmarkElements>(
    bookmarkSection,
    (register) => (
      <BookmarkStructure getRiSvg={getRiSvg} register={register} />
    )
  );
  roots.push(bookmarkRender.root);

  const recentSection = createHost(documentObj, 'section', {
    id: PAGE_STRUCTURE_IDS.recentSection,
    island: 'newtab-recent-section',
    visible: false
  });
  const recentRender = renderStatic<RecentElements>(
    recentSection,
    (register) => <RecentStructure register={register} />
  );
  roots.push(recentRender.root);

  const suggestionsContainer = createHost(documentObj, 'div', {
    id: PAGE_STRUCTURE_IDS.suggestionsContainer,
    island: 'newtab-suggestions-shell',
    visible: false
  });
  const suggestionsSurface = createHost(documentObj, 'div', {
    id: PAGE_STRUCTURE_IDS.suggestionsSurface,
    island: 'newtab-suggestions-surface',
    visible: false
  });
  const suggestionsOutline = createHost(documentObj, 'div', {
    id: PAGE_STRUCTURE_IDS.suggestionsOutline,
    island: 'newtab-suggestions-outline',
    visible: false
  });
  const searchLayer = createHost(documentObj, 'div', {
    id: PAGE_STRUCTURE_IDS.searchLayer,
    island: 'newtab-search-layer'
  });

  let destroyed = false;
  return Object.freeze({
    bookmark: {
      ...bookmarkRender.elements,
      section: bookmarkSection
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      roots.forEach((root) => flushSync(() => root.unmount()));
    },
    recent: {
      ...recentRender.elements,
      section: recentSection
    },
    searchLayer,
    shortcut: {
      ...shortcutRender.elements,
      section: shortcutSection
    },
    suggestions: {
      container: suggestionsContainer,
      outline: suggestionsOutline,
      surface: suggestionsSurface
    }
  });
}

export function createPageStructureApi() {
  return Object.freeze({
    IDS: PAGE_STRUCTURE_IDS,
    implementation: 'react',
    createPageStructure
  });
}
