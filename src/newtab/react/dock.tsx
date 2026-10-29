import { useLayoutEffect, useRef } from 'react';
import { getPagePortals } from '../app/portals';
import type {
  BottomDockLayoutOptions,
  ElementSource,
  LayoutConstants,
  LayoutController,
  LayoutControllerOptions
} from '../layout';
import { createLayoutController } from '../layout';

export const DOCK_IDS = Object.freeze({
  bottomDock: '_x_extension_newtab_bottom_dock_2024_unique_',
  scroller: '_x_extension_newtab_bottom_dock_scroller_2024_unique_',
  sectionSafeCorridor:
    '_x_extension_newtab_section_safe_corridor_2026_unique_'
});

export const DEFAULT_DOCK_LAYOUT_CONSTANTS = Object.freeze({
  bottomDockTopReservePx: 240,
  compactDockViewportMaxHeightPx: 800,
  compactDockSearchGapPx: 30,
  compactDockShortcutGapPx: 8,
  compactDockMinTopReservePx: 168
});

interface DockElements {
  scroller: HTMLDivElement;
  sectionSafeCorridor: HTMLDivElement;
}

function Dock({
  register
}: {
  register(elements: DockElements): void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const corridorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollerRef.current && corridorRef.current) {
      register({
        scroller: scrollerRef.current,
        sectionSafeCorridor: corridorRef.current
      });
    }
  }, [register]);
  return (
    <div id={DOCK_IDS.scroller} ref={scrollerRef}>
      <div id={DOCK_IDS.sectionSafeCorridor} ref={corridorRef} />
    </div>
  );
}

export interface BottomDockRuntimeConfig {
  documentObj?: Document;
  windowObj?: Window;
  root?: ElementSource;
  searchLayer?: ElementSource;
  inputParts?: LayoutControllerOptions['inputParts'];
  topContentContainer?: ElementSource;
  shortcutSection?: ElementSource;
  quoteSection?: ElementSource;
  bookmarkSection: HTMLElement;
  recentSection: HTMLElement;
  suggestionsContainer?: ElementSource;
  suggestionsSurface?: ElementSource;
  suggestionsOutline?: ElementSource;
  getTopInsetPx?: () => number;
  constants?: LayoutConstants;
}

export interface DockRuntime {
  appendSections(): DockRuntime;
  destroy(): void;
  element: HTMLDivElement;
  layoutController: LayoutController;
  mount(parent?: HTMLElement | null): DockRuntime;
  onScroll(
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): DockRuntime;
  scroller: HTMLDivElement;
  sectionSafeCorridor: HTMLDivElement;
  updateLayout(options?: BottomDockLayoutOptions): void;
}

export function createDock(
  config: BottomDockRuntimeConfig
): DockRuntime {
  const documentObj: Document = config.documentObj || document;
  const windowObj: Window = config.windowObj || window;
  const bottomDock = documentObj.createElement('div');
  bottomDock.id = DOCK_IDS.bottomDock;
  bottomDock.dataset.reactIsland = 'newtab-bottom-dock';
  const mounted: { elements: DockElements | null } = { elements: null };
  const register = (nextElements: DockElements) => {
    mounted.elements = nextElements;
  };
  getPagePortals().show(bottomDock, <Dock register={register} />);
  if (!mounted.elements) {
    throw new Error('Lumno New Tab React dock did not mount.');
  }
  const { scroller, sectionSafeCorridor } = mounted.elements;
  const layoutController = createLayoutController({
    documentObj,
    windowObj,
    root: config.root,
    searchLayer: config.searchLayer,
    inputParts: config.inputParts,
    topContentContainer: config.topContentContainer,
    shortcutSection: config.shortcutSection,
    quoteSection: config.quoteSection,
    bottomDock,
    bookmarkSection: config.bookmarkSection,
    recentSection: config.recentSection,
    sectionSafeCorridor,
    suggestionsContainer: config.suggestionsContainer,
    suggestionsSurface: config.suggestionsSurface,
    suggestionsOutline: config.suggestionsOutline,
    getTopInsetPx: config.getTopInsetPx,
    constants: {
      ...DEFAULT_DOCK_LAYOUT_CONSTANTS,
      ...(config.constants || {})
    }
  });
  let destroyed = false;
  const runtime: DockRuntime = {
    appendSections() {
      scroller.appendChild(config.bookmarkSection);
      scroller.appendChild(sectionSafeCorridor);
      scroller.appendChild(config.recentSection);
      return runtime;
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      getPagePortals().remove(bottomDock);
    },
    element: bottomDock,
    layoutController,
    mount(parent) {
      runtime.appendSections();
      (parent || documentObj.body).appendChild(bottomDock);
      return runtime;
    },
    onScroll(listener, eventOptions) {
      scroller.addEventListener('scroll', listener, eventOptions);
      return runtime;
    },
    scroller,
    sectionSafeCorridor,
    updateLayout(options) {
      layoutController.updateBottomDockLayout(options);
    }
  };
  return runtime;
}
