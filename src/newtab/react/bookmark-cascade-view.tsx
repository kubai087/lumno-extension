// The bookmark folder menu: one React root on the menu host draws every open
// level from the controller's model. The controller keeps the state (open
// levels, active and hover-suppressed rows) and the work that measures or
// animates (placement, width lock, opening motion, drop marks).
import { useCallback, useLayoutEffect, useRef } from 'react';
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import { FaviconFallback } from '../../shared/react/favicon-fallback';
import { RemixIcon } from '../../shared/react/remix-icon';
import { FolderIcon } from './folder-icon';
import { getPagePortals } from '../app/portals';

// The menu levels size to their content within these bounds.
const LEVEL_MIN_WIDTH_PX = 210;
const LEVEL_MAX_WIDTH_PX = 260;

export interface CascadeRowModel {
  key: string;
  isFolder: boolean;
  title: string;
  bookmarkId: string;
  parentId: string;
  // The bookmark's place in its folder, or '' when unknown.
  bookmarkIndex: string;
  draggable: boolean;
  active: boolean;
  expanded: boolean;
  hoverSuppressed: boolean;
  // The row's context menu is open.
  contextMenuOpen: boolean;
  // Folders: what makes the folder glyph's ids unique. Sites: a chosen
  // icon, else ''.
  folderIconSuffix: string;
  iconUrl: string;
  iconMonochrome: boolean;
  iconAlt: string;
  copyLabel: string;
}

export interface CascadeLevelModel {
  // Changes whenever the level is drawn afresh, so it mounts and opens again.
  key: string;
  levelIndex: number;
  title: string;
  emptyLabel: string;
  rows: readonly CascadeRowModel[];
}

export interface CascadeMenuModel {
  levels: readonly CascadeLevelModel[];
}

// A row event: the level, the row's key, the native event and the row's button.
type RowHandler<E extends Event> = (levelIndex: number, key: string, event: E, button: HTMLButtonElement) => void;

export interface CascadeMenuHandlers {
  onLevelElement(levelKey: string, element: HTMLDivElement | null): void;
  onRowPointerEnter: RowHandler<PointerEvent>;
  onRowPointerLeave: RowHandler<PointerEvent>;
  onRowPointerDown: RowHandler<PointerEvent>;
  onRowFocus: RowHandler<FocusEvent>;
  onRowClick: RowHandler<MouseEvent>;
  onRowAuxClick: RowHandler<MouseEvent>;
  onRowKeyDown: RowHandler<KeyboardEvent>;
  onRowContextMenu: RowHandler<MouseEvent>;
  onCopyShow: RowHandler<Event>;
  onCopyHide(): void;
  onCopyClick: RowHandler<MouseEvent>;
  // A site row's icon without a chosen one loads its favicon through the fallbacks.
  onSiteIconMount(levelIndex: number, key: string, image: HTMLImageElement): void;
  // A site row shows its title in a tooltip that follows the cursor.
  onSiteButtonMount(button: HTMLButtonElement, getTitle: () => string): void;
  onFolderIconMount(icon: HTMLElement): void;
  onFolderIconOpenChange(icon: HTMLElement, open: boolean): void;
}

function CascadeRow({
  handlers,
  index,
  levelIndex,
  row
}: {
  handlers: CascadeMenuHandlers;
  index: number;
  levelIndex: number;
  row: CascadeRowModel;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const folderIconRef = useRef<HTMLSpanElement>(null);
  const siteIconRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef(row.title);
  titleRef.current = row.title;
  const open = row.active || row.expanded;
  const openRef = useRef(open);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (folderIconRef.current) {
      handlers.onFolderIconMount(folderIconRef.current);
    }
    if (siteIconRef.current && !row.iconUrl) {
      handlers.onSiteIconMount(levelIndex, row.key, siteIconRef.current);
    }
    if (button && !row.isFolder) {
      handlers.onSiteButtonMount(button, () => titleRef.current);
    }
    // Each row's icon and tooltip are set up once, when it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (openRef.current === open) {
      return;
    }
    openRef.current = open;
    if (folderIconRef.current) {
      handlers.onFolderIconOpenChange(folderIconRef.current, open);
    }
  }, [handlers, open]);

  const rowEvent = <E extends Event>(handler: RowHandler<E>) =>
    (event: { nativeEvent: E; currentTarget: HTMLButtonElement }) =>
      handler(levelIndex, row.key, event.nativeEvent, event.currentTarget);
  const onPointerEnter = rowEvent(handlers.onRowPointerEnter);
  const onPointerLeave = rowEvent(handlers.onRowPointerLeave);
  const onPointerDown = rowEvent(handlers.onRowPointerDown);
  const onFocus: (event: ReactFocusEvent<HTMLButtonElement>) => void = rowEvent(handlers.onRowFocus);
  const onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void = rowEvent(handlers.onRowClick);
  const onAuxClick: (event: ReactMouseEvent<HTMLButtonElement>) => void = rowEvent(handlers.onRowAuxClick);
  const onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void = rowEvent(handlers.onRowKeyDown);
  const onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void = rowEvent(handlers.onRowContextMenu);
  const onCopyShow = (event: ReactPointerEvent<HTMLButtonElement> | ReactFocusEvent<HTMLButtonElement>) =>
    handlers.onCopyShow(levelIndex, row.key, event.nativeEvent, event.currentTarget);

  return (
    <div
      className={row.isFolder ? 'x-nt-bookmark-cascade-row x-nt-bookmark-cascade-row--folder' : 'x-nt-bookmark-cascade-row'}
      role="none"
    >
      <button
        aria-expanded={row.isFolder ? row.expanded : undefined}
        aria-haspopup={row.isFolder ? 'menu' : undefined}
        aria-label={row.title}
        className={row.isFolder ? 'x-nt-bookmark-cascade-item x-nt-bookmark-cascade-item--folder' : 'x-nt-bookmark-cascade-item'}
        data-active={row.active ? 'true' : 'false'}
        data-bookmark-dragging="false"
        data-bookmark-context-menu-open={row.contextMenuOpen ? 'true' : undefined}
        data-bookmark-draggable={row.draggable ? 'true' : 'false'}
        data-bookmark-drop-folder-id={row.isFolder ? row.bookmarkId : undefined}
        data-bookmark-drop-folder-title={row.isFolder ? row.title : undefined}
        data-bookmark-id={row.bookmarkId}
        data-bookmark-index={row.bookmarkIndex}
        data-bookmark-parent-id={row.parentId}
        data-hover-suppressed={row.hoverSuppressed ? 'true' : undefined}
        data-level={levelIndex}
        data-type={row.isFolder ? 'folder' : 'bookmark'}
        draggable={false}
        onAuxClick={onAuxClick}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragStart={(event) => event.preventDefault()}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        ref={buttonRef}
        role="menuitem"
        tabIndex={row.active ? 0 : -1}
        title={row.title}
        type="button"
      >
        {row.isFolder ? (
          <span
            aria-hidden="true"
            className="x-nt-bookmark-cascade-icon x-nt-bookmark-cascade-icon--folder"
            ref={folderIconRef}
          >
            <FolderIcon idSuffix={row.folderIconSuffix} folderId={row.bookmarkId} />
          </span>
        ) : (
          <img
            alt={row.iconAlt}
            className="x-nt-bookmark-cascade-icon"
            data-builtin-monochrome={row.iconMonochrome ? 'true' : undefined}
            draggable={false}
            loading={index < 4 ? 'eager' : 'lazy'}
            ref={siteIconRef}
            src={row.iconUrl || undefined}
          />
        )}
        {row.isFolder || row.iconUrl ? null : <FaviconFallback />}
        <span className="x-nt-bookmark-cascade-label">{row.title}</span>
        {row.isFolder ? (
          <span aria-hidden="true" className="x-nt-bookmark-cascade-arrow">
            <RemixIcon name="ri-arrow-right-s-line" size={16} />
          </span>
        ) : null}
      </button>
      {row.isFolder ? null : (
        <button
          aria-label={row.copyLabel}
          className="x-nt-bookmark-cascade-copy-trigger"
          data-tooltip={row.copyLabel}
          onBlur={() => handlers.onCopyHide()}
          onClick={(event) => handlers.onCopyClick(levelIndex, row.key, event.nativeEvent, event.currentTarget)}
          onFocus={onCopyShow}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={onCopyShow}
          onPointerLeave={() => handlers.onCopyHide()}
          type="button"
        >
          <RemixIcon name="ri-file-copy-line" size={16} />
        </button>
      )}
    </div>
  );
}

function CascadeLevel({ handlers, level }: { handlers: CascadeMenuHandlers; level: CascadeLevelModel }) {
  const levelKey = level.key;
  const ref = useCallback(
    (element: HTMLDivElement | null) => handlers.onLevelElement(levelKey, element),
    [handlers, levelKey]
  );
  return (
    <div
      className={level.levelIndex > 0
        ? 'x-nt-bookmark-cascade-level x-nt-bookmark-cascade-submenu _x_extension_menu_surface_2024_unique_'
        : 'x-nt-bookmark-cascade-level _x_extension_menu_surface_2024_unique_'}
      data-level={level.levelIndex}
      data-menu-surface-width="content"
      ref={ref}
      role="menu"
      style={{
        '--x-extension-menu-surface-min-width': `${LEVEL_MIN_WIDTH_PX}px`,
        '--x-extension-menu-surface-max-width': `${LEVEL_MAX_WIDTH_PX}px`
      }}
    >
      <div className="x-nt-bookmark-cascade-content" role="none">
        {level.title ? (
          <div className="x-nt-bookmark-cascade-title" role="presentation" title={level.title}>
            {level.title}
          </div>
        ) : null}
        {level.rows.length === 0 ? <div className="x-nt-bookmark-cascade-empty">{level.emptyLabel}</div> : null}
        {level.rows.map((row, index) => (
          <CascadeRow handlers={handlers} index={index} key={row.key} levelIndex={level.levelIndex} row={row} />
        ))}
      </div>
    </div>
  );
}

export interface CascadeMenuView {
  element: HTMLDivElement;
  render(model: CascadeMenuModel): void;
  destroy(): void;
}

export function createCascadeMenu(documentObj: Document, handlers: CascadeMenuHandlers): CascadeMenuView {
  const element = documentObj.createElement('div');
  element.className = 'x-nt-bookmark-cascade-menu';
  element.dataset.reactIsland = 'newtab-bookmark-cascade';
  element.setAttribute('role', 'menu');
  let destroyed = false;
  return {
    element,
    render(model) {
      if (destroyed) {
        return;
      }
      getPagePortals().show(element, (
        <>
          {model.levels.map((level) => <CascadeLevel handlers={handlers} key={level.key} level={level} />)}
        </>
      ));
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      getPagePortals().remove(element);
    }
  };
}
