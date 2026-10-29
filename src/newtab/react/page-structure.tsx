import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { createRenderStore, type RenderStore } from '../../shared/react/render-store';
import { BookmarkHeader, type BookmarkHeaderElements, type BookmarkHeaderModel, type BookmarkHeaderStore } from './bookmark-header';
import { RecentModeSwitch, type RecentModeSwitchModel } from './recent-mode-switch';
import { newtabShortcutsLegacy } from '../../domain/settings/newtab-shortcuts';

export const PAGE_STRUCTURE_IDS = Object.freeze({
  suggestionsContainer:
    '_x_extension_newtab_suggestions_container_2024_unique_',
  suggestionsSurface: '_x_extension_newtab_suggestions_surface_2026_unique_',
  suggestionsOutline: '_x_extension_newtab_suggestions_outline_2026_unique_',
  shortcutSection: newtabShortcutsLegacy.key,
  bookmarkSection: '_x_extension_newtab_bookmarks_2024_unique_',
  bookmarkGrid: '_x_extension_newtab_bookmarks_grid_2024_unique_',
  recentSection: '_x_extension_newtab_recent_sites_2024_unique_',
  recentGrid: '_x_extension_newtab_recent_sites_grid_2024_unique_',
  searchLayer: '_x_extension_newtab_search_layer_2024_unique_'
});

interface ShortcutElements {
  grid: HTMLDivElement;
}

interface RecentElements {
  grid: HTMLDivElement;
  header: HTMLDivElement;
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

// The recent section's heading: the current mode's name, which the mode
// switch stands in for once the section has one.
export interface RecentHeaderModel {
  heading: string;
  modeSwitch: RecentModeSwitchModel | null;
}

function RecentStructure({
  register,
  store
}: {
  register(elements: RecentElements): void;
  store: RenderStore<RecentHeaderModel>;
}) {
  const header = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (gridRef.current && headerRef.current) {
      register({ grid: gridRef.current, header: headerRef.current });
    }
  }, [register]);
  return (
    <>
      <div className="x-nt-recent-header-bar" ref={headerRef}>
        <div className="x-nt-recent-heading" hidden={Boolean(header.modeSwitch)}>
          {header.heading}
        </div>
        {header.modeSwitch ? <RecentModeSwitch model={header.modeSwitch} /> : null}
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
  const mounted: { elements: T | null } = { elements: null };
  const register = (nextElements: T) => {
    mounted.elements = nextElements;
  };
  const root = createRoot(host);
  flushSync(() => root.render(render(register)));
  if (!mounted.elements) {
    flushSync(() => root.unmount());
    throw new Error('Lumno New Tab React page structure did not mount.');
  }
  return { elements: mounted.elements, root };
}

export interface PageStructureRuntime {
  bookmark: BookmarkHeaderElements & {
    section: HTMLElement;
    // A plain host: the bookmarks view draws into it, and the top bar holds it in top bar mode.
    grid: HTMLDivElement;
    headerStore: BookmarkHeaderStore;
    renderHeader(model: BookmarkHeaderModel): void;
  };
  destroy(): void;
  recent: RecentElements & {
    section: HTMLElement;
    renderHeader(model: RecentHeaderModel): void;
  };
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
} = {}): PageStructureRuntime {
  const documentObj = config.documentObj || document;
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
  const bookmarkHeader = documentObj.createElement('div');
  bookmarkHeader.className = 'x-nt-bookmarks-header';
  const bookmarkGrid = documentObj.createElement('div');
  bookmarkGrid.id = PAGE_STRUCTURE_IDS.bookmarkGrid;
  bookmarkSection.append(bookmarkHeader, bookmarkGrid);
  const bookmarkHeaderStore = createRenderStore<BookmarkHeaderModel | null>(null);
  const bookmarkRender = renderStatic<BookmarkHeaderElements>(
    bookmarkHeader,
    (register) => <BookmarkHeader register={register} store={bookmarkHeaderStore} />
  );
  roots.push(bookmarkRender.root);

  const recentSection = createHost(documentObj, 'section', {
    id: PAGE_STRUCTURE_IDS.recentSection,
    island: 'newtab-recent-section',
    visible: false
  });
  const recentHeaderStore = createRenderStore<RecentHeaderModel>({ heading: '', modeSwitch: null });
  const recentRender = renderStatic<RecentElements>(
    recentSection,
    (register) => <RecentStructure register={register} store={recentHeaderStore} />
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
      section: bookmarkSection,
      grid: bookmarkGrid,
      headerStore: bookmarkHeaderStore,
      renderHeader: (model: BookmarkHeaderModel) => {
        if (!destroyed) bookmarkHeaderStore.render(model);
      }
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
      section: recentSection,
      renderHeader: (model: RecentHeaderModel) => {
        if (!destroyed) recentHeaderStore.render(model);
      }
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
