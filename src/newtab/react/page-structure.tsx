import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createViewStore } from '../../shared/react/view-store';
import { useStore } from '../../shared/react/use-store';
import type { Store } from '../../shared/state/store';
import { BookmarkHeader, type BookmarkHeaderElements, type BookmarkHeaderModel, type BookmarkHeaderStore } from './bookmark-header';
import { RecentModeSwitch, type RecentModeSwitchModel } from './recent-mode-switch';
import { newtabShortcutsLegacy } from '../../domain/settings/newtab-shortcuts';
import { getPagePortals } from '../app/portals';

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
  store: Store<RecentHeaderModel>;
}) {
  const header = useStore(store);
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
  getPagePortals().show(host, render(register));
  if (!mounted.elements) {
    getPagePortals().remove(host);
    throw new Error('Lumno New Tab React page structure did not mount.');
  }
  return mounted.elements;
}

export interface PageStructureRuntime {
  bookmark: BookmarkHeaderElements & {
    section: HTMLElement;
    // A plain host: the bookmarks view draws into it, and the top bar holds it in top bar mode.
    grid: HTMLDivElement;
    headerStore: BookmarkHeaderStore;
  };
  destroy(): void;
  recent: RecentElements & {
    section: HTMLElement;
    headerStore: Store<RecentHeaderModel>;
  };
  searchLayer: HTMLDivElement;
  shortcut: ShortcutElements & { section: HTMLElement };
  // The wordmark or clock above the search box; its controller draws into it.
  topContent: HTMLDivElement;
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

  const shortcutSection = createHost(documentObj, 'section', {
    className: 'x-nt-shortcuts-section',
    id: PAGE_STRUCTURE_IDS.shortcutSection,
    island: 'newtab-shortcut-section'
  });
  const shortcutRender = renderStatic<ShortcutElements>(
    shortcutSection,
    (register) => <ShortcutStructure register={register} />
  );

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
  // The headers' models, as the section headers set them.
  const bookmarkHeaderStore: BookmarkHeaderStore = createViewStore<{ model: BookmarkHeaderModel | null }>({ model: null });
  const bookmarkRender = renderStatic<BookmarkHeaderElements>(
    bookmarkHeader,
    (register) => <BookmarkHeader register={register} store={bookmarkHeaderStore} />
  );

  const recentSection = createHost(documentObj, 'section', {
    id: PAGE_STRUCTURE_IDS.recentSection,
    island: 'newtab-recent-section',
    visible: false
  });
  const recentHeaderStore = createViewStore<RecentHeaderModel>({ heading: '', modeSwitch: null });
  const recentRender = renderStatic<RecentElements>(
    recentSection,
    (register) => <RecentStructure register={register} store={recentHeaderStore} />
  );

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
  const topContent = documentObj.createElement('div');

  let destroyed = false;
  return Object.freeze({
    bookmark: {
      ...bookmarkRender,
      section: bookmarkSection,
      grid: bookmarkGrid,
      headerStore: bookmarkHeaderStore
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      [shortcutSection, bookmarkSection, recentSection].forEach((section) => getPagePortals().remove(section));
    },
    recent: {
      ...recentRender,
      section: recentSection,
      headerStore: recentHeaderStore
    },
    searchLayer,
    shortcut: {
      ...shortcutRender,
      section: shortcutSection
    },
    suggestions: {
      container: suggestionsContainer,
      outline: suggestionsOutline,
      surface: suggestionsSurface
    },
    topContent
  });
}
