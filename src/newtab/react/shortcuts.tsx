import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { flushSync } from 'react-dom';
import {
  getIconPlateStyle,
  normalizeIconPlateMode,
  type IconPlateAnalysis,
  type IconPlateColors,
  type IconPlateInput
} from './shortcut-dialog-helpers';
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import { queryHtmlElements, queryHtmlTag, queryHtmlTags } from '../../shared/dom-lookup';
import { FaviconFallback } from '../../shared/react/favicon-fallback';
import { createRenderStore, type RenderStore } from '../../shared/react/render-store';
import { RemixIcon } from '../../shared/react/remix-icon';
import { FolderIcon } from './folder-icon';
import type { ShortcutGroup, ShortcutLink, VisibleShortcutFolder, VisibleShortcutItem } from '../../domain/shortcuts/types';
import { getPagePortals } from '../app/portals';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import { shortcutIconEvents } from '../shortcuts/shortcut-icon-events';
import { useCardTheme } from './card-theme';

// A site's theme as the page resolves it; the view passes it through.
type ThemeValue = Partial<ThemeVariant> | null;

export type { ShortcutGroup, VisibleShortcutItem };

// Without `grouped`, shortcuts render as one centered run of tiles.
export interface ShortcutsLayout {
  grouped?: boolean;
  groups?: ShortcutGroup[];
}

interface ThemeSuggestion {
  type: 'shortcut';
  url: string;
  title: string;
  customIconDataUrl: string;
}

export interface ShortcutTileElement extends HTMLButtonElement {
  _xSetBookmarkMenuVisualActive?: (active: boolean) => void;
}

export interface ShortcutsViewOptions {
  initFolderIcon?: (icon: HTMLElement) => void;
  animateFolderIcon?: (icon: HTMLElement, active: boolean) => void;
  onFolderMenuChange?: (tile: HTMLElement) => void;
  grid?: HTMLElement | null;
  tiles?: ShortcutTileElement[];
  maxShortcuts?: number;
  getShortcutTitle?: (shortcut: VisibleShortcutItem) => string;
  getHostFromUrl?: (url: string) => string;
  getShortcutIconDataUrl?: (shortcutId: string) => string;
  getShortcutFaviconDataUrl?: (pageUrl: string) => string;
  resolveShortcutFaviconDataUrl?: (pageUrl: string) => Promise<string>;
  getShortcutFaviconPolicyRevision?: () => number;
  getShortcutFaviconCandidateUrl?: (url: string) => string;
  // Reads a loaded icon's pixels: is it see-through, and which colors.
  analyzeShortcutIcon?: (image: HTMLImageElement) => IconPlateAnalysis | null;
  resolveShortcutIconPlate?: (input: IconPlateInput) => IconPlateColors | null;
  getImmediateThemeForSuggestion?: (
    suggestion: ThemeSuggestion
  ) => ThemeValue;
  applyShortcutTileTheme?: (
    tile: ShortcutTileElement,
    theme: ThemeValue,
    host: string
  ) => void;
  queueThemeForTarget?: (
    tile: ShortcutTileElement,
    suggestion: ThemeSuggestion,
    onTheme: (theme: ThemeValue) => void,
    options: { priority: number }
  ) => void;
  // The theme a tile takes when its site's theme changes.
  getTileThemeOnSiteChange?: (suggestion: ThemeSuggestion, siteTheme: ThemeVariant) => Promise<ThemeValue>;
  attachFaviconWithFallbacks?: (
    image: HTMLImageElement,
    pageUrl: string,
    host: string,
    options: {
      primaryUrl: string;
      browserUrl?: string;
      pageSpecificUrl?: string;
      skipPersisted?: boolean;
      sourceProfile?: 'shortcut';
    }
  ) => void;
  bindTooltip?: (
    target: HTMLElement,
    getText: () => string,
    options: { maxWidth: number }
  ) => unknown;
  hideTooltip?: () => void;
  formatOpenLabel?: (title: string) => string;
  isMiddleClick?: (event: ReactMouseEvent<HTMLElement>) => boolean;
  openShortcut?: (
    shortcut: VisibleShortcutItem,
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
  ) => void;
  // True right after a press on an open context menu, so it does not open
  // the tile underneath.
  isActivationSuppressed?: () => boolean;
  // Alt+ArrowLeft/Right on a tile: move it one place (-1 or 1); true when
  // it moved.
  moveShortcut?: (shortcutId: string, direction: number) => boolean;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onNativeDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  getAddLabel?: () => string;
  getAddVisible?: () => boolean;
  onAdd?: (sourceElement: HTMLButtonElement) => void;
  onAddContextMenu?: (sourceElement: HTMLButtonElement) => void;
  groupHeaders?: HTMLElement[];
  getGroupPlaceholder?: () => string;
  getGroupActionsLabel?: (title: string) => string;
  onGroupMenu?: (groupId: string, anchor: HTMLElement) => void;
  onGroupRename?: (groupId: string, sourceElement: HTMLElement) => void;
  getGroupEmptyLabel?: () => string;
  onGroupAdd?: (groupId: string, sourceElement: HTMLButtonElement) => void;
}

// What a shortcut context menu is open for: a tile, a group's menu button
// or the add tile.
export type ShortcutContextMenuMark =
  | { kind: 'shortcut'; shortcutId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'add' };

export interface ShortcutsViewController {
  render(items: VisibleShortcutItem[], layout?: ShortcutsLayout): { count: number };
  fitGroupedColumns(items: VisibleShortcutItem[], groups: ShortcutGroup[]): boolean;
  clear(): void;
  refreshElements(): void;
  getTiles(): ShortcutTileElement[];
  getAddButton(): HTMLButtonElement | null;
  // Marks what a context menu is open for, or nothing.
  setContextMenuMark(mark: ShortcutContextMenuMark | null): void;
}

interface NormalizedOptions {
  contextMenuMark: RenderStore<ShortcutContextMenuMark | null>;
  initFolderIcon: (icon: HTMLElement) => void;
  animateFolderIcon: (icon: HTMLElement, active: boolean) => void;
  onFolderMenuChange: (tile: HTMLElement) => void;
  grid: HTMLElement;
  tiles: ShortcutTileElement[];
  maxShortcuts: number;
  getShortcutTitle: (shortcut: VisibleShortcutItem) => string;
  getHostFromUrl: (url: string) => string;
  getShortcutIconDataUrl: (shortcutId: string) => string;
  getShortcutFaviconDataUrl: (pageUrl: string) => string;
  resolveShortcutFaviconDataUrl: (pageUrl: string) => Promise<string>;
  getShortcutFaviconPolicyRevision: () => number;
  getShortcutFaviconCandidateUrl: (url: string) => string;
  analyzeShortcutIcon: NonNullable<ShortcutsViewOptions['analyzeShortcutIcon']>;
  resolveShortcutIconPlate: NonNullable<ShortcutsViewOptions['resolveShortcutIconPlate']>;
  getImmediateThemeForSuggestion: (
    suggestion: ThemeSuggestion
  ) => ThemeValue;
  applyShortcutTileTheme: (
    tile: ShortcutTileElement,
    theme: ThemeValue,
    host: string
  ) => void;
  queueThemeForTarget: (
    tile: ShortcutTileElement,
    suggestion: ThemeSuggestion,
    onTheme: (theme: ThemeValue) => void,
    options: { priority: number }
  ) => void;
  getTileThemeOnSiteChange: NonNullable<ShortcutsViewOptions['getTileThemeOnSiteChange']>;
  attachFaviconWithFallbacks: (
    image: HTMLImageElement,
    pageUrl: string,
    host: string,
    options: {
      primaryUrl: string;
      browserUrl?: string;
      pageSpecificUrl?: string;
      skipPersisted?: boolean;
      sourceProfile?: 'shortcut';
    }
  ) => void;
  bindTooltip: (
    target: HTMLElement,
    getText: () => string,
    options: { maxWidth: number }
  ) => unknown;
  hideTooltip: () => void;
  formatOpenLabel: (title: string) => string;
  isMiddleClick: (event: ReactMouseEvent<HTMLElement>) => boolean;
  openShortcut: (
    shortcut: VisibleShortcutItem,
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
  ) => void;
  isActivationSuppressed: () => boolean;
  moveShortcut: (shortcutId: string, direction: number) => boolean;
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onNativeDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  getAddLabel: () => string;
  getAddVisible: () => boolean;
  onAdd: (sourceElement: HTMLButtonElement) => void;
  onAddContextMenu: (sourceElement: HTMLButtonElement) => void;
  groupHeaders: HTMLElement[];
  getGroupPlaceholder: () => string;
  getGroupActionsLabel: (title: string) => string;
  onGroupMenu: (groupId: string, anchor: HTMLElement) => void;
  onGroupRename: (groupId: string, sourceElement: HTMLElement) => void;
  getGroupEmptyLabel: () => string;
  onGroupAdd: (groupId: string, sourceElement: HTMLButtonElement) => void;
}

function normalizeOptions(
  options: ShortcutsViewOptions = {}
): NormalizedOptions | null {
  if (!options.grid) {
    return null;
  }
  return {
    contextMenuMark: createRenderStore<ShortcutContextMenuMark | null>(null),
    initFolderIcon: options.initFolderIcon || (() => {}),
    animateFolderIcon: options.animateFolderIcon || (() => {}),
    onFolderMenuChange: options.onFolderMenuChange || (() => {}),
    grid: options.grid,
    tiles: Array.isArray(options.tiles) ? options.tiles : [],
    maxShortcuts: Number.isFinite(Number(options.maxShortcuts))
      ? Math.max(0, Math.floor(Number(options.maxShortcuts)))
      : Number.POSITIVE_INFINITY,
    getShortcutTitle: options.getShortcutTitle || (() => ''),
    getHostFromUrl: options.getHostFromUrl || (() => ''),
    getShortcutIconDataUrl: options.getShortcutIconDataUrl || (() => ''),
    getShortcutFaviconDataUrl:
      options.getShortcutFaviconDataUrl || (() => ''),
    resolveShortcutFaviconDataUrl:
      options.resolveShortcutFaviconDataUrl || (() => Promise.resolve('')),
    getShortcutFaviconPolicyRevision:
      options.getShortcutFaviconPolicyRevision || (() => 0),
    getShortcutFaviconCandidateUrl:
      options.getShortcutFaviconCandidateUrl || (() => ''),
    analyzeShortcutIcon: options.analyzeShortcutIcon || (() => null),
    resolveShortcutIconPlate: options.resolveShortcutIconPlate || (() => null),
    getImmediateThemeForSuggestion:
      options.getImmediateThemeForSuggestion || (() => null),
    applyShortcutTileTheme: options.applyShortcutTileTheme || (() => {}),
    queueThemeForTarget: options.queueThemeForTarget || (() => {}),
    getTileThemeOnSiteChange: options.getTileThemeOnSiteChange || ((_suggestion, siteTheme) => Promise.resolve(siteTheme)),
    attachFaviconWithFallbacks:
      options.attachFaviconWithFallbacks || (() => {}),
    bindTooltip: options.bindTooltip || (() => null),
    hideTooltip: options.hideTooltip || (() => {}),
    formatOpenLabel: options.formatOpenLabel || ((title) => title),
    isMiddleClick:
      options.isMiddleClick ||
      ((event) => Number(event.button) === 1),
    openShortcut: options.openShortcut || (() => {}),
    isActivationSuppressed: options.isActivationSuppressed || (() => false),
    moveShortcut: options.moveShortcut || (() => false),
    onContextMenu: options.onContextMenu || (() => {}),
    onNativeDragStart: options.onNativeDragStart || ((event) => {
      event.preventDefault();
    }),
    getAddLabel: options.getAddLabel || (() => ''),
    getAddVisible: options.getAddVisible || (() => true),
    onAdd: options.onAdd || (() => {}),
    onAddContextMenu: options.onAddContextMenu || (() => {}),
    groupHeaders: Array.isArray(options.groupHeaders) ? options.groupHeaders : [],
    getGroupPlaceholder: options.getGroupPlaceholder || (() => ''),
    getGroupActionsLabel: options.getGroupActionsLabel || ((title) => title),
    onGroupMenu: options.onGroupMenu || (() => {}),
    onGroupRename: options.onGroupRename || (() => {}),
    getGroupEmptyLabel: options.getGroupEmptyLabel || (() => ''),
    onGroupAdd: options.onGroupAdd || (() => {})
  };
}

function isFolderShortcut(shortcut: VisibleShortcutItem): shortcut is VisibleShortcutFolder {
  return shortcut.type === 'folder';
}

function useContextMenuMark(options: NormalizedOptions): ShortcutContextMenuMark | null {
  return useSyncExternalStore(options.contextMenuMark.subscribe, options.contextMenuMark.getSnapshot);
}

function ShortcutFavicon({
  shortcut,
  host,
  options
}: {
  shortcut: ShortcutLink;
  host: string;
  options: NormalizedOptions;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const shortcutId = shortcut.id;
  const url = shortcut.url;
  const iconSource = shortcut.iconSource || '';
  const localIconDataUrl = options.getShortcutIconDataUrl(shortcutId);
  const primaryFaviconUrl = options.getShortcutFaviconCandidateUrl(url);
  const isBuiltinIcon = !localIconDataUrl && /\/assets\/images\/site-search\/glyph-[a-z0-9]+\.(?:svg|png)(?:[?#]|$)/.test(primaryFaviconUrl);
  const isMonochromeBuiltinIcon = isBuiltinIcon && /\/glyph-(?:gh|gpt|mdn|wk|zw)\.svg(?:[?#]|$)/.test(primaryFaviconUrl);
  const cachedFaviconDataUrl = options.getShortcutFaviconDataUrl(url);
  const faviconPolicyRevision = options.getShortcutFaviconPolicyRevision();
  const [resolvedFavicon, setResolvedFavicon] = useState({ url, iconSource, dataUrl: cachedFaviconDataUrl });
  // Keyed by the artwork it was read from, so a changed URL or icon never
  // shows the previous icon's plate.
  const iconKey = localIconDataUrl || url;
  const [iconAnalysis, setIconAnalysis] = useState<{ key: string; src: string; analysis: IconPlateAnalysis | null }>({
    key: '', src: '', analysis: null
  });
  const plateMode = normalizeIconPlateMode(shortcut.iconPlate);
  const plate = plateMode === 'off' ? null : options.resolveShortcutIconPlate({
    mode: plateMode,
    color: shortcut.iconPlateColor || '',
    // Built-in glyphs are drawn for the bare tile.
    eligible: !isBuiltinIcon || plateMode === 'on',
    analysis: iconAnalysis.key === iconKey ? iconAnalysis.analysis : null
  });
  const fallbackFaviconDataUrl =
    cachedFaviconDataUrl || (resolvedFavicon.url === url && resolvedFavicon.iconSource === iconSource ? resolvedFavicon.dataUrl : '');

  useEffect(() => {
    let cancelled = false;
    if (localIconDataUrl || cachedFaviconDataUrl || primaryFaviconUrl) {
      setResolvedFavicon({ url, iconSource, dataUrl: cachedFaviconDataUrl });
      return () => {
        cancelled = true;
      };
    }
    setResolvedFavicon({ url, iconSource, dataUrl: '' });
    options.resolveShortcutFaviconDataUrl(url).then((dataUrl) => {
      if (!cancelled && dataUrl) {
        setResolvedFavicon({ url, iconSource, dataUrl });
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cachedFaviconDataUrl, faviconPolicyRevision, iconSource, localIconDataUrl, options, primaryFaviconUrl, url]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }
    if (localIconDataUrl) {
      return;
    }
    options.attachFaviconWithFallbacks(image, url, host, {
      primaryUrl: primaryFaviconUrl,
      pageSpecificUrl: fallbackFaviconDataUrl,
      skipPersisted: true,
      sourceProfile: 'shortcut'
    });
  }, [fallbackFaviconDataUrl, host, localIconDataUrl, options, primaryFaviconUrl, url]);

  // Read the artwork whenever it loads or the favicon runtime relabels it:
  // the runtime marks an image as a placeholder until its own load handler,
  // which runs after a React one, clears the mark.
  useEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return undefined;
    }
    const read = () => {
      if (!image.complete || !image.naturalWidth) return;
      const src = image.currentSrc || image.src;
      // Letter fallbacks and placeholders are not the site's artwork.
      const isFallback = image.getAttribute('data-fallback-icon') === 'true' ||
        image.getAttribute('data-favicon-placeholder') === 'true';
      const analysis = isFallback ? null : options.analyzeShortcutIcon(image);
      setIconAnalysis((current) => (current.key === iconKey && current.src === src &&
        current.analysis === analysis ? current : { key: iconKey, src, analysis }));
    };
    const MutationObserverCtor = image.ownerDocument.defaultView?.MutationObserver;
    const observer = MutationObserverCtor ? new MutationObserverCtor(read) : null;
    observer?.observe(image, { attributes: true, attributeFilter: ['src', 'data-fallback-icon', 'data-favicon-placeholder'] });
    image.addEventListener('load', read);
    read();
    return () => {
      observer?.disconnect();
      image.removeEventListener('load', read);
    };
  }, [iconKey, options]);

  return (
    <span className="x-nt-shortcut-icon">
      <span
        className="x-nt-shortcut-favicon-mask"
        data-builtin-icon={isBuiltinIcon ? 'true' : undefined}
        data-builtin-monochrome={isMonochromeBuiltinIcon ? 'true' : undefined}
        data-icon-plate={plate ? 'true' : undefined}
        style={getIconPlateStyle(plate)}
      >
        <img
          key={iconKey}
          ref={imageRef}
          className="x-nt-shortcut-favicon"
          alt=""
          loading="lazy"
          draggable={false}
          src={localIconDataUrl || undefined}
        />
        {/* A saved local icon needs no fallback; a new icon starts with a hidden one. */}
        {localIconDataUrl ? null : <FaviconFallback key={`fallback:${iconKey}`} />}
      </span>
    </span>
  );
}

function ShortcutTile({
  shortcut,
  options
}: {
  shortcut: VisibleShortcutItem;
  options: NormalizedOptions;
}) {
  const tileRef = useRef<ShortcutTileElement>(null);
  const folderIconRef = useRef<HTMLSpanElement>(null);
  const folder = isFolderShortcut(shortcut) ? shortcut : null;
  const link = isFolderShortcut(shortcut) ? null : shortcut;
  const folderId = folder ? folder.folderId : '';
  const isFolder = Boolean(folder);
  const title = options.getShortcutTitle(shortcut);
  const url = link ? link.url : '';
  const host = link && link.host ? link.host : options.getHostFromUrl(url);
  const shortcutId = shortcut.id || url;
  const contextMenuMark = useContextMenuMark(options);
  const contextMenuOpen = Boolean(contextMenuMark && contextMenuMark.kind === 'shortcut' &&
    contextMenuMark.shortcutId === shortcutId);
  // A folder tile's contents menu is open; its icon stays open for that or its context menu.
  const [menuOpen, setMenuOpen] = useState(false);
  const folderOpen = isFolder && (menuOpen || contextMenuOpen);
  const folderOpenRef = useRef(false);
  const localIconDataUrl = options.getShortcutIconDataUrl(shortcut.id);
  const themeSuggestion = useMemo<ThemeSuggestion>(() => ({
    type: 'shortcut',
    url,
    title,
    customIconDataUrl: localIconDataUrl
  }), [localIconDataUrl, title, url]);

  const immediateTheme = useMemo(() => options.getImmediateThemeForSuggestion(themeSuggestion), [options, themeSuggestion]);
  // Counts the icon snapshots saved for this page after the tile drew.
  const [snapshotCount, setSnapshotCount] = useState(0);
  useEffect(() => {
    const pageUrl = !isFolder && !localIconDataUrl ? ShortcutIconCache.normalizePageUrl(url) : '';
    return pageUrl
      ? shortcutIconEvents.on('snapshotSaved', (saved) => {
        if (saved.pageUrl === pageUrl) {
          setSnapshotCount((count) => count + 1);
        }
      })
      : undefined;
  }, [isFolder, localIconDataUrl, url]);
  useCardTheme(tileRef, {
    immediateTheme,
    host,
    subject: isFolder ? null : themeSuggestion,
    priority: 0,
    queue: options.queueThemeForTarget,
    apply: options.applyShortcutTileTheme,
    followSite: options.getTileThemeOnSiteChange,
    readKey: snapshotCount
  });

  useLayoutEffect(() => {
    const tile = tileRef.current;
    if (!tile) {
      return;
    }
    options.bindTooltip(
      tile,
      () => tile.getAttribute('data-shortcut-title') || title,
      { maxWidth: 360 }
    );
    if (isFolder && folderIconRef.current) {
      options.initFolderIcon(folderIconRef.current);
      // The folder menu calls this from outside React and reads the tile right after.
      tile._xSetBookmarkMenuVisualActive = (active) => flushSync(() => setMenuOpen(active));
      return () => { delete tile._xSetBookmarkMenuVisualActive; };
    }
    return undefined;
  }, [isFolder, options, title]);

  useLayoutEffect(() => {
    if (folderOpenRef.current === folderOpen) {
      return;
    }
    folderOpenRef.current = folderOpen;
    if (folderIconRef.current) {
      options.animateFolderIcon(folderIconRef.current, folderOpen);
    }
    if (tileRef.current) {
      options.onFolderMenuChange(tileRef.current);
    }
  }, [folderOpen, options]);

  function activate(
    event: ReactMouseEvent<HTMLButtonElement> |
      ReactKeyboardEvent<HTMLButtonElement>
  ): void {
    if (event.type === 'click' && options.isActivationSuppressed()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    options.hideTooltip();
    options.openShortcut(shortcut, event);
  }

  function handleAuxClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (!options.isMiddleClick(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (options.isActivationSuppressed()) {
      return;
    }
    options.openShortcut(shortcut, event);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      // Alt+Arrow would also go back or forward in the browser.
      event.preventDefault();
      event.stopPropagation();
      options.moveShortcut(shortcutId, event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    activate(event);
  }

  return (
    <button
      ref={tileRef}
      type="button"
      className={`x-nt-shortcut-tile${isFolder ? ' x-nt-shortcut-tile--folder' : ''}`}
      draggable={false}
      data-shortcut-id={shortcutId}
      data-shortcut-group-id={shortcut.groupId || undefined}
      data-shortcut-url={url}
      data-shortcut-title={title}
      data-shortcut-draggable="true"
      data-bookmark-id={isFolder ? folderId : undefined}
      data-bookmark-drop-folder-id={isFolder ? folderId : undefined}
      data-bookmark-drop-folder-title={isFolder ? title : undefined}
      aria-haspopup={isFolder ? 'menu' : undefined}
      aria-expanded={isFolder ? menuOpen : undefined}
      data-shortcut-folder-open={folderOpen ? 'true' : undefined}
      data-shortcut-context-menu-open={contextMenuOpen ? 'true' : undefined}
      data-shortcut-custom-icon={localIconDataUrl ? 'true' : undefined}
      data-shortcut-from-bookmark={link && link.fromBookmark === true ? 'true' : undefined}
      data-tooltip={title}
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
      aria-label={options.formatOpenLabel(title)}
      onClick={activate}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      onContextMenu={options.onContextMenu}
      onDragStart={options.onNativeDragStart}
      onPointerEnter={() => {
        if (folderIconRef.current && !document.body.hasAttribute('data-drag-source')) {
          options.animateFolderIcon(folderIconRef.current, true);
        }
      }}
      onPointerLeave={() => {
        if (folderIconRef.current && !folderOpenRef.current) {
          options.animateFolderIcon(folderIconRef.current, false);
        }
      }}
    >
      {link ? <ShortcutFavicon
        shortcut={link}
        host={host}
        options={options}
      /> : <span
        ref={folderIconRef}
        className="x-nt-shortcut-icon x-nt-shortcut-icon--folder"
      >
        <FolderIcon idSuffix={`shortcut-${shortcutId}`} folderId={folderId} />
      </span>}
    </button>
  );
}

// A group's title row spans the whole grid, so its tiles start on a new row
// and every row holds tiles of one group. The title renames in a dialog.
function ShortcutGroupHeader({
  group,
  options
}: {
  group: ShortcutGroup;
  options: NormalizedOptions;
}) {
  const moreRef = useRef<HTMLButtonElement>(null);
  const contextMenuMark = useContextMenuMark(options);
  const contextMenuOpen = Boolean(contextMenuMark && contextMenuMark.kind === 'group' &&
    contextMenuMark.groupId === group.id);

  function openMenu(): void {
    options.hideTooltip();
    if (moreRef.current) {
      options.onGroupMenu(group.id, moreRef.current);
    }
  }

  return (
    <div
      className="x-nt-shortcut-group-header"
      data-shortcut-group-id={group.id}
      data-shortcut-group-untitled={group.title ? undefined : 'true'}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu();
      }}
    >
      {group.title ? (
        <span
          className="x-nt-shortcut-group-title"
          onDoubleClick={(event) => options.onGroupRename(group.id, event.currentTarget)}
        >
          {group.title}
        </span>
      ) : (
        <button
          type="button"
          className="x-nt-shortcut-group-title x-nt-shortcut-group-title--placeholder"
          onClick={(event) => options.onGroupRename(group.id, event.currentTarget)}
        >
          {options.getGroupPlaceholder()}
        </button>
      )}
      <button
        ref={moreRef}
        type="button"
        className="x-nt-shortcut-group-more"
        data-shortcut-context-menu-open={contextMenuOpen ? 'true' : undefined}
        aria-haspopup="menu"
        aria-label={options.getGroupActionsLabel(group.title)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openMenu();
        }}
      >
        <RemixIcon name="ri-more-fill" size={16} />
      </button>
    </div>
  );
}

function ShortcutsList({
  items,
  layout,
  options,
  addButtonRef
}: {
  items: VisibleShortcutItem[];
  layout: ShortcutsLayout;
  options: NormalizedOptions;
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const addLabel = options.getAddLabel();
  const contextMenuMark = useContextMenuMark(options);
  const keys = new Map<string, number>();
  const renderTile = (shortcut: VisibleShortcutItem) => {
    const identity = shortcut.id || (isFolderShortcut(shortcut) ? '' : shortcut.url) || 'shortcut';
    const occurrence = keys.get(identity) || 0;
    keys.set(identity, occurrence + 1);
    return (
      <ShortcutTile
        key={`${identity}:${occurrence}`}
        shortcut={shortcut}
        options={options}
      />
    );
  };
  const groups = layout.grouped && Array.isArray(layout.groups) ? layout.groups : null;
  const emptyLabel = options.getGroupEmptyLabel();
  const isEmpty = (group: ShortcutGroup) => !items.some((shortcut) => shortcut.groupId === group.id);
  // An empty group shows a slot that adds a site to it and takes drops;
  // when the last group is empty, that slot stands in for the add tile.
  const lastGroupEmpty = Boolean(groups && groups.length && isEmpty(groups[groups.length - 1]));
  return (
    <>
      {groups
        ? groups.flatMap((group) => [
          <ShortcutGroupHeader
            key={`group:${group.id}`}
            group={group}
            options={options}
          />,
          ...(isEmpty(group)
            ? [
              <button
                key={`group-empty:${group.id}`}
                type="button"
                className="x-nt-shortcut-group-empty"
                data-shortcut-group-id={group.id}
                aria-label={emptyLabel}
                hidden={items.length >= options.maxShortcuts}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  options.hideTooltip();
                  options.onGroupAdd(group.id, event.currentTarget);
                }}
              >
                <span
                  className="x-nt-shortcut-icon x-nt-shortcut-icon--add"
                >
                  <RemixIcon name="ri-add-line" />
                </span>
              </button>
            ]
            : items.filter((shortcut) => shortcut.groupId === group.id).map(renderTile))
        ])
        : items.map(renderTile)}
      <button
        ref={addButtonRef}
        type="button"
        className="x-nt-shortcut-tile x-nt-shortcut-tile--add"
        data-shortcut-context-menu-open={contextMenuMark && contextMenuMark.kind === 'add' ? 'true' : undefined}
        hidden={!options.getAddVisible() || items.length >= options.maxShortcuts || lastGroupEmpty}
        data-tooltip={addLabel}
        aria-label={addLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.hideTooltip();
          options.onAdd(event.currentTarget);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.hideTooltip();
          options.onAddContextMenu(event.currentTarget);
        }}
      >
        <span
          className="x-nt-shortcut-icon x-nt-shortcut-icon--add"
        >
          <RemixIcon name="ri-add-line" />
        </span>
      </button>
    </>
  );
}

function createNoopController(
  options: ShortcutsViewOptions
): ShortcutsViewController {
  const tiles = Array.isArray(options.tiles) ? options.tiles : [];
  return {
    render() {
      tiles.length = 0;
      return { count: 0 };
    },
    fitGroupedColumns() {
      return false;
    },
    clear() {
      tiles.length = 0;
    },
    refreshElements() {
      tiles.length = 0;
    },
    getTiles() {
      return tiles;
    },
    getAddButton() {
      return null;
    },
    setContextMenuMark() {}
  };
}

export function createShortcutsView(
  rawOptions: ShortcutsViewOptions = {}
): ShortcutsViewController {
  const normalizedOptions = normalizeOptions(rawOptions);
  if (!normalizedOptions) {
    return createNoopController(rawOptions);
  }
  const options: NormalizedOptions = normalizedOptions;
  const addButtonRef: { current: HTMLButtonElement | null } = { current: null };
  options.grid.setAttribute('data-react-island', 'shortcuts');

  function refreshElements(): void {
    options.tiles.length = 0;
    queryHtmlTags(options.grid, '.x-nt-shortcut-tile[data-shortcut-id]', 'button')
      .forEach((tile) => options.tiles.push(tile));
    addButtonRef.current = queryHtmlTag(options.grid, '.x-nt-shortcut-tile--add', 'button');
    options.groupHeaders.length = 0;
    queryHtmlElements(options.grid, '.x-nt-shortcut-group-header')
      .forEach((header) => options.groupHeaders.push(header));
  }

  // The longest group row in slots: its tiles, plus the slot of an empty
  // group or the add tile ending the last group. Grouped rows hug this many
  // columns, so a short set of groups stays centered under the search box.
  function getGroupedColumnCount(items: VisibleShortcutItem[], groups: ShortcutGroup[]): number {
    const addVisible = options.getAddVisible() && items.length < options.maxShortcuts;
    return Math.max(1, ...groups.map((group, index) => {
      const count = items.filter((shortcut) => shortcut.groupId === group.id).length;
      if (!count) {
        return items.length < options.maxShortcuts ? 1 : 0;
      }
      return count + (index === groups.length - 1 && addVisible ? 1 : 0);
    }));
  }

  function render(items: VisibleShortcutItem[], layout: ShortcutsLayout = {}): { count: number } {
    const normalizedItems = Array.isArray(items) ? items : [];
    const groups = layout.grouped && layout.groups && layout.groups.length ? layout.groups : null;
    const grouped = Boolean(groups);
    options.hideTooltip();
    if (groups) {
      options.grid.setAttribute('data-shortcut-grouped', 'true');
      fitGroupedColumns(normalizedItems, groups);
    } else {
      options.grid.removeAttribute('data-shortcut-grouped');
      options.grid.style.removeProperty('--x-nt-shortcut-grouped-columns');
    }
    getPagePortals().show(options.grid, (
      <ShortcutsList
        items={normalizedItems}
        layout={{ ...layout, grouped }}
        options={options}
        addButtonRef={addButtonRef}
      />
    ));
    refreshElements();
    const addButton = addButtonRef.current;
    if (addButton) {
      options.bindTooltip(
        addButton,
        () => addButton.getAttribute('data-tooltip') || options.getAddLabel(),
        { maxWidth: 260 }
      );
    }
    queryHtmlTags(options.grid, '.x-nt-shortcut-group-empty', 'button')
      .forEach((slot) => {
        options.bindTooltip(
          slot,
          () => slot.getAttribute('aria-label') || options.getGroupEmptyLabel(),
          { maxWidth: 260 }
        );
      });
    return { count: normalizedItems.length };
  }

  // Sizes a grouped grid to its longest row. A drag moves tiles between
  // groups without a render and calls this as the tile joins or leaves a
  // row, so a longer row does not wrap, a shorter one re-centers at once,
  // and the drop leaves everything where the drag showed it. Returns
  // whether the column count changed.
  function fitGroupedColumns(items: VisibleShortcutItem[], groups: ShortcutGroup[]): boolean {
    if (options.grid.getAttribute('data-shortcut-grouped') !== 'true' ||
        !Array.isArray(items) || !Array.isArray(groups) || !groups.length) {
      return false;
    }
    const next = String(getGroupedColumnCount(items, groups));
    if (options.grid.style.getPropertyValue('--x-nt-shortcut-grouped-columns') === next) {
      return false;
    }
    options.grid.style.setProperty('--x-nt-shortcut-grouped-columns', next);
    return true;
  }

  return {
    render,
    fitGroupedColumns,
    clear() {
      options.hideTooltip();
      getPagePortals().show(options.grid, null);
      options.tiles.length = 0;
      options.groupHeaders.length = 0;
      addButtonRef.current = null;
    },
    refreshElements,
    getTiles() {
      return options.tiles;
    },
    getAddButton() {
      return addButtonRef.current;
    },
    setContextMenuMark(mark) {
      options.contextMenuMark.render(mark);
    }
  };
}
