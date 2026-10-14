import { useLayoutEffect, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export interface CascadeItemView {
  button: HTMLButtonElement;
  copyButton: HTMLButtonElement | null;
  pinButton: HTMLButtonElement | null;
  icon: HTMLImageElement | HTMLSpanElement | null;
  row: HTMLDivElement;
}

export interface CascadeLevelView {
  content: HTMLDivElement;
  destroy(): void;
  element: HTMLDivElement;
  items: CascadeItemView[];
}

export interface CascadeDebugOverlayView {
  destroy(): void;
  label: HTMLDivElement;
  polygon: SVGPolygonElement;
  svg: SVGSVGElement;
}

export interface CascadeDebugControlView {
  button: HTMLButtonElement;
  destroy(): void;
  element: HTMLDivElement;
}

interface CascadeItem {
  host?: string;
  id?: string | number;
  index?: number;
  parentId?: string | number;
  themeUrl?: string;
  title?: string;
  type?: string;
  url?: string;
}

function CascadeLevel({
  copyLabel,
  pinLabel,
  emptyLabel,
  folderId,
  folderTitle,
  getFigmaFolderSvg,
  getRiSvg,
  getUrlDisplay,
  items,
  levelIndex,
  register,
  sanitizeDisplayText,
  siteIconAlt
}: {
  copyLabel: string;
  pinLabel: string;
  emptyLabel: string;
  folderId: string;
  folderTitle: string;
  getFigmaFolderSvg(suffix: string, folderId?: string): string;
  getRiSvg(icon: string, className: string): string;
  getUrlDisplay(url: string): string;
  items: CascadeItem[];
  levelIndex: number;
  register(content: HTMLDivElement, items: CascadeItemView[]): void;
  sanitizeDisplayText(value: unknown): string;
  siteIconAlt: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    const itemViews = Array.from(
      content.querySelectorAll<HTMLDivElement>('[data-cascade-view-index]')
    ).map((row) => ({
      row,
      button: row.querySelector<HTMLButtonElement>(
        '.x-nt-bookmark-cascade-item'
      ) as HTMLButtonElement,
      copyButton: row.querySelector<HTMLButtonElement>(
        '.x-nt-bookmark-cascade-copy-trigger'
      ),
      pinButton: row.querySelector<HTMLButtonElement>('.x-nt-bookmark-cascade-pin-trigger'),
      icon: row.querySelector<HTMLImageElement | HTMLSpanElement>(
        '.x-nt-bookmark-cascade-icon'
      )
    }));
    register(content, itemViews);
  }, [register]);
  const cleanFolderTitle = sanitizeDisplayText(folderTitle);
  return (
    <div className="x-nt-bookmark-cascade-content" ref={contentRef} role="none">
      {cleanFolderTitle ? (
        <div
          className="x-nt-bookmark-cascade-title"
          role="presentation"
          title={cleanFolderTitle}
        >
          {cleanFolderTitle}
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="x-nt-bookmark-cascade-empty">{emptyLabel}</div>
      ) : null}
      {items.map((item, index) => {
        const isFolder = item.type === 'folder';
        const titleText = sanitizeDisplayText(
          item.title || (item.url ? getUrlDisplay(item.url) : folderTitle)
        );
        const parentId = String(item.parentId || folderId || '');
        const bookmarkIndex = Number.isFinite(Number(item.index))
          ? String(item.index)
          : '';
        const draggable = Boolean(
          item.id && parentId && Number.isFinite(Number(item.index))
        );
        return (
          <div
            className={`x-nt-bookmark-cascade-row${
              isFolder ? ' x-nt-bookmark-cascade-row--folder' : ''
            }`}
            data-cascade-view-index={index}
            key={`${String(item.id || item.url || index)}-${index}`}
            role="none"
          >
            <button
              aria-expanded={isFolder ? false : undefined}
              aria-haspopup={isFolder ? 'menu' : undefined}
              aria-label={titleText}
              className={`x-nt-bookmark-cascade-item${
                isFolder ? ' x-nt-bookmark-cascade-item--folder' : ''
              }`}
              data-bookmark-dragging="false"
              data-bookmark-draggable={draggable ? 'true' : 'false'}
              data-bookmark-drop-folder-id={
                isFolder ? String(item.id || '') : undefined
              }
              data-bookmark-drop-folder-title={
                isFolder ? titleText : undefined
              }
              data-bookmark-id={String(item.id || '')}
              data-bookmark-index={bookmarkIndex}
              data-bookmark-parent-id={parentId}
              data-level={levelIndex}
              data-type={isFolder ? 'folder' : 'bookmark'}
              draggable={false}
              role="menuitem"
              tabIndex={-1}
              title={titleText}
              type="button"
            >
              {isFolder ? (
                <span
                  aria-hidden="true"
                  className="x-nt-bookmark-cascade-icon x-nt-bookmark-cascade-icon--folder"
                  dangerouslySetInnerHTML={{
                    __html: getFigmaFolderSvg(
                      `${String(item.id || 'folder')}-cascade-${index}`, String(item.id || '')
                    )
                  }}
                />
              ) : (
                <img
                  alt={siteIconAlt}
                  className="x-nt-bookmark-cascade-icon"
                  draggable={false}
                  loading={index < 4 ? 'eager' : 'lazy'}
                />
              )}
              <span className="x-nt-bookmark-cascade-label">{titleText}</span>
              {isFolder ? (
                <span
                  aria-hidden="true"
                  className="x-nt-bookmark-cascade-arrow"
                  dangerouslySetInnerHTML={{
                    __html: getRiSvg(
                      'ri-arrow-right-s-line',
                      'ri-size-16'
                    )
                  }}
                />
              ) : null}
            </button>
            {!isFolder && item.url ? (
              <button type="button" aria-label={`${pinLabel}: ${titleText}`}
                className="x-nt-bookmark-cascade-pin-trigger"
                dangerouslySetInnerHTML={{ __html: getRiSvg('ri-pushpin-line', 'ri-size-16') }} />
            ) : null}
            {!isFolder && item.url ? (
              <button
                aria-label={copyLabel}
                className="x-nt-bookmark-cascade-copy-trigger"
                data-tooltip={copyLabel}
                dangerouslySetInnerHTML={{
                  __html: getRiSvg('ri-file-copy-line', 'ri-size-16')
                }}
                type="button"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function createCascadeMenu(documentObj: Document = document) {
  const element = documentObj.createElement('div');
  element.className = 'x-nt-bookmark-cascade-menu';
  element.dataset.reactIsland = 'newtab-bookmark-cascade';
  element.setAttribute('role', 'menu');
  return element;
}

export function createCascadeDebugOverlay(
  menu: HTMLElement
): CascadeDebugOverlayView {
  const documentObj = menu.ownerDocument || document;
  const rootHost = documentObj.createElement('div');
  const root = createRoot(rootHost);
  let svg: SVGSVGElement | null = null;
  let polygon: SVGPolygonElement | null = null;
  let label: HTMLDivElement | null = null;
  flushSync(() => {
    root.render(
      <>
        {createPortal(
          <svg
            aria-hidden="true"
            className="x-nt-bookmark-cascade-debug-svg"
            focusable="false"
            ref={(element) => {
              svg = element;
            }}
          >
            <polygon
              className="x-nt-bookmark-cascade-safe-triangle"
              data-visible="false"
              ref={(element) => {
                polygon = element;
              }}
            />
          </svg>,
          menu
        )}
        {createPortal(
          <div
            aria-hidden="true"
            className="x-nt-bookmark-cascade-debug-label"
            data-visible="false"
            ref={(element) => {
              label = element;
            }}
          />,
          menu
        )}
      </>
    );
  });
  if (!svg || !polygon || !label) {
    flushSync(() => root.unmount());
    throw new Error('Lumno React bookmark cascade debug overlay did not mount.');
  }
  let destroyed = false;
  return {
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    label,
    polygon,
    svg
  };
}

export function createCascadeDebugControl(
  documentObj: Document = document
): CascadeDebugControlView {
  const element = documentObj.createElement('div');
  element.className = 'x-nt-bookmark-cascade-debug-control';
  element.dataset.reactIsland = 'newtab-bookmark-cascade-debug-control';
  const root = createRoot(element);
  let button: HTMLButtonElement | null = null;
  flushSync(() => {
    root.render(
      <button
        aria-label="Bookmark menu diagnostics"
        aria-pressed="false"
        className="x-nt-bookmark-cascade-debug-button"
        ref={(node) => {
          button = node;
        }}
        type="button"
      >
        <i aria-hidden="true" className="ri-icon ri-size-16 ri-triangle-line" />
      </button>
    );
  });
  if (!button) {
    flushSync(() => root.unmount());
    throw new Error('Lumno React bookmark cascade debug control did not mount.');
  }
  let destroyed = false;
  return {
    button,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    element
  };
}

export function createCascadeLevel(config: Record<string, any>): CascadeLevelView {
  const documentObj: Document = config.documentObj || document;
  const levelIndex = Math.max(0, Number.parseInt(config.levelIndex, 10) || 0);
  const element = documentObj.createElement('div');
  element.className = `x-nt-bookmark-cascade-level${
    levelIndex > 0 ? ' x-nt-bookmark-cascade-submenu' : ''
  }`;
  element.dataset.level = String(levelIndex);
  element.dataset.reactIsland = 'newtab-bookmark-cascade-level';
  element.setAttribute('role', 'menu');
  const root: Root = createRoot(element);
  let content: HTMLDivElement | null = null;
  let itemViews: CascadeItemView[] = [];
  const register = (
    nextContent: HTMLDivElement,
    nextItems: CascadeItemView[]
  ) => {
    content = nextContent;
    itemViews = nextItems;
  };
  const rawItems = Array.isArray(config.items) ? config.items : [];
  const items = rawItems.filter(
    (item) => item && (item.url || item.type === 'folder')
  );
  flushSync(() =>
    root.render(
      <CascadeLevel
        copyLabel={String(config.copyLabel || 'Copy link')}
        pinLabel={String(config.pinLabel || 'Add to shortcuts')}
        emptyLabel={String(config.emptyLabel || 'No content')}
        folderId={String(config.folderId || '')}
        folderTitle={String(config.folderTitle || '')}
        getFigmaFolderSvg={
          typeof config.getFigmaFolderSvg === 'function'
            ? config.getFigmaFolderSvg
            : () => ''
        }
        getRiSvg={
          typeof config.getRiSvg === 'function' ? config.getRiSvg : () => ''
        }
        getUrlDisplay={
          typeof config.getUrlDisplay === 'function'
            ? config.getUrlDisplay
            : (url) => String(url || '')
        }
        items={items}
        levelIndex={levelIndex}
        register={register}
        sanitizeDisplayText={
          typeof config.sanitizeDisplayText === 'function'
            ? config.sanitizeDisplayText
            : (value) => String(value || '')
        }
        siteIconAlt={String(config.siteIconAlt || 'Site')}
      />
    )
  );
  if (!content) {
    flushSync(() => root.unmount());
    throw new Error('Lumno React bookmark cascade level did not mount.');
  }
  let destroyed = false;
  return {
    content,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    element,
    items: itemViews
  };
}

export function createBookmarkCascadeViewApi() {
  return Object.freeze({
    implementation: 'react',
    createDebugControl: createCascadeDebugControl,
    createDebugOverlay: createCascadeDebugOverlay,
    createLevel: createCascadeLevel,
    createMenu: createCascadeMenu
  });
}
