// The search scope panel under the search input: tiles for each search
// mode in their groups, the filter's highlights, an empty state and the
// footer's key hints. The input mode controller (search/search-input-mode.ts)
// keeps the panel's state and hands it a model; focus, scrolling and
// measuring stay with the controller.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type RefObject
} from 'react';
import * as LumnoSortableDrag from '../../ui/sortable-drag';
import { followEmptyStateArtIn } from '../../ui/empty-state-art';
import { EmptyStateArt } from '../empty-state-art';
import { className as MENU_SURFACE_CLASS } from '../../ui/menu-surface';
import { HOST_CLASS as CURSOR_TOOLTIP_HOST_CLASS } from '../../ui/cursor-tooltip-model';
import { getModeLineIconPaths } from '../../search/input-mode/line-icons';
import { createViewStore } from '../view-store';
import type { Store } from '../../state/store';
import { FONT_STACK, NO_TRANSLATE, SURFACE_VARS, type ModeSurface } from './mode-surface';
import type { ModeMenuRange } from '../../search/input-mode/types';
import { CLOSED_MODEL } from '../../search/input-mode/mode-menu-model';
import type { ModeMenuHandlers, ModeMenuLabels, ModeMenuModel, ModeMenuTile, ModeMenuTileIcon } from '../../search/input-mode/mode-menu-model';
import { RemixIcon } from '../remix-icon';

export interface ModeMenuSnapshot {
  model: ModeMenuModel;
  handlers: ModeMenuHandlers | null;
}

export type ModeMenuStore = Store<ModeMenuSnapshot>;

export function createModeMenuStore(): ModeMenuStore {
  return createViewStore<ModeMenuSnapshot>({ model: CLOSED_MODEL, handlers: null });
}

// The panel sits below the input, pushed down by the results shown above
// it (--x-lumno-search-mode-menu-result-offset) and capped to the viewport
// (--x-lumno-search-mode-menu-viewport-max-height); the controller sets both.
function getMenuStyle(surface: ModeSurface, hasQuery: boolean): CSSProperties {
  const vars = SURFACE_VARS[surface];
  const position = 'translateY(calc(var(--x-lumno-search-mode-menu-result-offset, 0px) + var(--x-lumno-search-mode-menu-lift, 0px)))';
  const closedTransform = surface === 'newtab'
    ? `${position} scale(0.96, 0.86)`
    : 'translateY(calc(var(--x-lumno-search-mode-menu-result-offset, 0px) + var(--x-lumno-search-mode-menu-lift, 0px) - 6px)) scale(0.96, 0.86)';
  const height = 'min(360px, 62vh, var(--x-lumno-search-mode-menu-viewport-max-height, 360px))';
  return {
    position: 'absolute',
    left: vars.edge,
    right: vars.edge,
    top: `calc(100% + ${vars.gap})`,
    width: 'auto',
    height,
    maxHeight: height,
    overflow: 'hidden',
    padding: '0',
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    background: vars.panelBackground,
    boxShadow: vars.shadow,
    boxSizing: 'border-box',
    fontFamily: FONT_STACK,
    fontSize: '13px',
    color: vars.text,
    zIndex: 40,
    '--x-lumno-search-mode-menu-lift': hasQuery ? '-8px' : '0px',
    '--x-extension-menu-surface-closed-transform': closedTransform,
    '--x-extension-menu-surface-open-transform': `${position} scale(1, 1)`,
    overscrollBehavior: 'contain'
  };
}

function LineIcon({ name, className, strokeWidth }: { name: string; className?: string; strokeWidth: string }) {
  const paths = getModeLineIconPaths(name);
  if (!paths) {
    return null;
  }
  return (
    <svg
      className={className}
      data-icon-name={name}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      {paths.map((path) => <path d={path} key={path} />)}
    </svg>
  );
}

function TileIcon({ icon, color, attachIconData }: {
  icon: ModeMenuTileIcon;
  color: string;
  attachIconData: ModeMenuHandlers['attachIconData'] | null;
}) {
  const [state, setState] = useState<'fallback' | 'resolved' | 'failed'>('fallback');
  const builtIn = Boolean(getModeLineIconPaths(icon.lineIcon));
  const attach = useRef(attachIconData);
  attach.current = attachIconData;
  const imageRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image && attach.current && !icon.iconUrl.startsWith('data:')) {
      attach.current(image, icon.iconUrl, icon.iconHost);
    }
  }, [icon.iconUrl, icon.iconHost]);
  return (
    <span
      aria-hidden="true"
      className="x-lumno-search-input-mode__menu-icon"
      data-icon-kind={builtIn ? 'builtin' : undefined}
      data-icon-state={state === 'resolved' ? 'resolved' : 'fallback'}
      style={{ '--x-lumno-search-mode-icon-color': color }}
    >
      <span className="x-lumno-search-input-mode__menu-favicon-mask">
        {builtIn ? (
          state === 'resolved' ? null : (
            <LineIcon
              className="x-lumno-search-input-mode__menu-line-icon"
              name={icon.lineIcon}
              strokeWidth="1.65"
            />
          )
        ) : (
          <RemixIcon hidden={state === 'resolved'} name={icon.glyphName} size={24} />
        )}
        {icon.iconUrl && state !== 'failed' ? (
          <img
            alt=""
            decoding="async"
            onError={() => setState('failed')}
            onLoad={() => setState('resolved')}
            ref={imageRef}
            referrerPolicy="no-referrer"
            src={icon.iconUrl}
          />
        ) : null}
      </span>
    </span>
  );
}

// The label, with the filter's matches marked.
function TileLabel({ text, ranges }: { text: string; ranges: readonly ModeMenuRange[] }) {
  const parts: Array<{ text: string; marked: boolean }> = [];
  const sorted = ranges
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.min(text.length, range.end)
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start);
  let offset = 0;
  sorted.forEach((range) => {
    if (range.start < offset) {
      return;
    }
    if (range.start > offset) {
      parts.push({ text: text.slice(offset, range.start), marked: false });
    }
    parts.push({ text: text.slice(range.start, range.end), marked: true });
    offset = range.end;
  });
  if (offset < text.length) {
    parts.push({ text: text.slice(offset), marked: false });
  }
  return (
    <>
      {parts.map((part, index) => (part.marked
        ? <mark className="x-lumno-search-input-mode__menu-match" key={index}>{part.text}</mark>
        : part.text))}
    </>
  );
}

function Tile({ tile, handlers, registerButton }: {
  tile: ModeMenuTile;
  handlers: ModeMenuHandlers | null;
  registerButton(id: string, button: HTMLButtonElement | null): void;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const bindTooltip = useRef(handlers ? handlers.bindLabelTooltip : null);
  bindTooltip.current = handlers ? handlers.bindLabelTooltip : null;
  useLayoutEffect(() => {
    const button = buttonRef.current;
    const label = labelRef.current;
    if (button && label && bindTooltip.current) {
      bindTooltip.current(button, label);
    }
  }, []);
  const onClick = (event: ReactMouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (handlers) {
      handlers.onSelect(tile.id);
    }
  };
  return (
    <button
      aria-checked={tile.checked ? 'true' : 'false'}
      aria-label={tile.label}
      className={`x-lumno-search-input-mode__menu-item ${CURSOR_TOOLTIP_HOST_CLASS}`}
      data-mode-id={tile.id}
      data-sort-list={tile.sortList || undefined}
      hidden={tile.hidden}
      onClick={onClick}
      ref={(button) => {
        buttonRef.current = button;
        registerButton(tile.id, button);
      }}
      role="menuitemradio"
      style={{
        '--x-lumno-search-mode-selected-bg': tile.colors.selectedBackground,
        '--x-lumno-search-mode-item-focus-ring': tile.colors.focusRing
      }}
      tabIndex={-1}
      type="button"
    >
      <TileIcon
        attachIconData={handlers ? handlers.attachIconData : null}
        color={tile.colors.icon}
        icon={tile.icon}
        key={tile.icon.iconUrl}
      />
      <span aria-hidden="true" className="x-lumno-search-input-mode__menu-label" ref={labelRef}>
        <TileLabel ranges={tile.ranges} text={tile.label} />
      </span>
    </button>
  );
}

const GROUP_MOVES = [
  ['up', -1, 'ri-arrow-up-s-line'],
  ['down', 1, 'ri-arrow-down-s-line']
] as const;

// A group title; hovering it shows move up and move down for the group.
function GroupTitle({ title, groupKey, hidden, first, last, model, handlers }: {
  title: string;
  groupKey: string;
  hidden: boolean;
  first: boolean;
  last: boolean;
  model: ModeMenuModel;
  handlers: ModeMenuHandlers | null;
}) {
  const movable = model.canMoveGroups && Boolean(groupKey);
  return (
    <div
      aria-hidden="true"
      className="x-lumno-search-input-mode__menu-group"
      data-group-key={movable ? groupKey : undefined}
      hidden={hidden}
      role="presentation"
    >
      {movable ? (
        <>
          <span>{title}</span>
          <span className="x-lumno-search-input-mode__menu-group-move">
            {GROUP_MOVES.map(([direction, delta, iconName]) => {
              const label = direction === 'up' ? model.labels.moveUp : model.labels.moveDown;
              return (
                <button
                  aria-label={label}
                  className="x-lumno-search-input-mode__menu-group-move-button"
                  data-group-move={direction}
                  disabled={direction === 'up' ? first : last}
                  key={direction}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (handlers) {
                      handlers.onGroupMove(groupKey, delta);
                    }
                  }}
                  tabIndex={-1}
                  title={label}
                  type="button"
                >
                  <RemixIcon name={iconName} />
                </button>
              );
            })}
          </span>
        </>
      ) : title}
    </div>
  );
}

const EMPTY_ART_SIZE = 96;

function EmptyState({ text, hidden }: { text: string; hidden: boolean }) {
  const artRef = useRef<HTMLSpanElement>(null);
  // Its theme follows the panel's while it shows.
  useLayoutEffect(() => {
    return hidden ? undefined : followEmptyStateArtIn(artRef.current);
  }, [hidden]);
  return (
    <div {...NO_TRANSLATE} className="x-lumno-search-input-mode__menu-empty" hidden={hidden} role="status">
      <span className="x-lumno-search-input-mode__menu-empty-art" ref={artRef}>
        <EmptyStateArt name="noResults" size={EMPTY_ART_SIZE} />
      </span>
      <span data-i18n="overlay_empty_result">{text}</span>
    </div>
  );
}

const FOOTER = 'x-lumno-search-input-mode__menu-footer';

function FooterHint({ name, keyText, text, keyClass }: { name: string; keyText: string; text: string; keyClass?: string }) {
  const footerPart = (part: string) => ({ [`data-search-input-mode-menu-footer-${part}`]: '' });
  return (
    <span {...NO_TRANSLATE} {...footerPart(`${name}-hint`)} className={`${FOOTER}-hint ${FOOTER}-hint--${name}`}>
      <span {...NO_TRANSLATE} {...footerPart(name === 'shortcut' ? 'key' : `${name}-key`)} className={keyClass ? `${FOOTER}-key ${keyClass}` : `${FOOTER}-key`}>{keyText}</span>
      <span {...NO_TRANSLATE} {...footerPart(name === 'shortcut' ? 'text' : `${name}-text`)} className={`${FOOTER}-text`}>{text}</span>
    </span>
  );
}

function Footer({ labels }: { labels: ModeMenuLabels }) {
  const { filter } = labels;
  return (
    <div
      {...NO_TRANSLATE}
      aria-hidden="true"
      className={FOOTER}
      data-search-input-mode-menu-footer=""
      role="presentation"
    >
      <span {...NO_TRANSLATE} className={`${FOOTER}-filter-text`} data-search-input-mode-menu-footer-filter-text="">
        {filter.before}
        {filter.mark ? <mark className="x-lumno-search-input-mode__menu-match">{filter.mark}</mark> : null}
        {filter.after}
      </span>
      <span {...NO_TRANSLATE} className={`${FOOTER}-actions`} data-search-input-mode-menu-footer-actions="">
        <FooterHint keyClass={`${FOOTER}-key--arrows`} keyText={labels.navigationKey} name="navigation" text={labels.navigation} />
        <FooterHint keyText={labels.selectKey} name="select" text={labels.select} />
        <FooterHint keyText={labels.inputKey} name="input" text={labels.input} />
        <FooterHint keyText={labels.shortcutKey} name="shortcut" text={labels.shortcut} />
      </span>
    </div>
  );
}

interface GroupTitleRun {
  title: string;
  groupKey: string;
  // Where its title goes: before the tile at this index.
  start: number;
  // Every tile of the group the filter left out.
  hidden: boolean;
}

// A title wherever the group changes.
function getGroupTitles(tiles: readonly ModeMenuTile[]): GroupTitleRun[] {
  const titles: GroupTitleRun[] = [];
  let previous = '';
  tiles.forEach((tile, index) => {
    if (tile.group && tile.group !== previous) {
      titles.push({ title: tile.group, groupKey: tile.groupKey, start: index, hidden: true });
      previous = tile.group;
    }
  });
  titles.forEach((run) => {
    run.hidden = !tiles.some((tile) => tile.group === run.title && !tile.hidden);
  });
  return titles;
}

// Dragging a tile reorders it among the tiles of its own order list in
// its group (custom searches among custom ones, built-ins among built-ins).
function useTileReorder(contentRef: RefObject<HTMLDivElement | null>, buttons: RefObject<Map<string, HTMLButtonElement>>,
  latest: RefObject<ModeMenuSnapshot>): void {
  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return undefined;
    }
    const tileOf = (button: HTMLElement): ModeMenuTile | undefined => {
      const id = button.dataset.modeId || '';
      return latest.current.model.tiles.find((tile) => tile.id === id);
    };
    const peersOf = (tile: ModeMenuTile): ModeMenuTile[] => latest.current.model.tiles.filter((candidate) => (
      candidate.group === tile.group && !candidate.hidden && candidate.sortList === tile.sortList
    ));
    return LumnoSortableDrag.attach(content, {
      itemSelector: '.x-lumno-search-input-mode__menu-item[data-sort-list]',
      canStart: () => {
        const current = latest.current.model;
        return current.open && current.canReorder && !current.filtered;
      },
      getPeers: (button) => {
        const tile = tileOf(button);
        return tile ? peersOf(tile).map((peer) => buttons.current.get(peer.id)) : [];
      },
      onReorder: (button, fromIndex, toIndex, peers) => {
        const tile = tileOf(button);
        const current = latest.current.handlers;
        if (!tile || !current) {
          return;
        }
        const ordered = peers.map((peer) => peer.dataset.modeId || '');
        ordered.splice(toIndex, 0, ordered.splice(fromIndex, 1)[0]);
        current.onReorder(tile.id, tile.sortList, ordered);
      }
    });
  }, [buttons, contentRef, latest]);
}

// The tiles, with a group title wherever the group changes.
function MenuTiles({ model, handlers, registerButton }: {
  model: ModeMenuModel;
  handlers: ModeMenuHandlers | null;
  registerButton(id: string, button: HTMLButtonElement | null): void;
}) {
  const titles = getGroupTitles(model.tiles);
  const movableTitles = titles.filter((run) => run.groupKey);
  const children: ReactElement[] = [];
  model.tiles.forEach((tile, index) => {
    const run = titles.find((candidate) => candidate.start === index);
    if (run) {
      const movableIndex = movableTitles.indexOf(run);
      children.push(
        <GroupTitle
          first={movableIndex === 0}
          groupKey={run.groupKey}
          handlers={handlers}
          hidden={run.hidden}
          key={`group:${run.groupKey}:${run.title}:${index}`}
          last={movableIndex === movableTitles.length - 1}
          model={model}
          title={run.title}
        />
      );
    }
    children.push(<Tile handlers={handlers} key={tile.id} registerButton={registerButton} tile={tile} />);
  });
  return <>{children}</>;
}

export function ModeMenu({ store, prefixId, surface }: {
  store: ModeMenuStore;
  prefixId: string;
  surface: ModeSurface;
}) {
  const { model, handlers } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // The latest model and handlers, for the drag listeners attached once.
  const latest = useRef<ModeMenuSnapshot>({ model, handlers });
  latest.current = { model, handlers };
  useTileReorder(contentRef, buttons, latest);

  const registerButton = (id: string, button: HTMLButtonElement | null): void => {
    if (button) {
      buttons.current.set(id, button);
    } else {
      buttons.current.delete(id);
    }
  };

  // Roving focus: only the focused tile takes Tab.
  useLayoutEffect(() => {
    buttons.current.forEach((button, id) => {
      button.tabIndex = id === model.focusId ? 0 : -1;
    });
  });

  const visibleCount = model.tiles.filter((tile) => !tile.hidden).length;
  return (
    <div
      {...NO_TRANSLATE}
      aria-busy={model.busy ? 'true' : undefined}
      aria-labelledby={prefixId}
      className={`x-lumno-search-input-mode__menu ${MENU_SURFACE_CLASS}`}
      data-filtered={model.filtered ? 'true' : 'false'}
      data-has-query={model.hasQuery ? 'true' : 'false'}
      data-open={model.revealed ? 'true' : 'false'}
      data-search-active={model.searchActive ? 'true' : 'false'}
      data-search-input-mode-menu=""
      data-surface={surface}
      hidden={!model.open}
      id={`${prefixId}-menu`}
      onKeyDown={(event) => handlers?.onKeyDown(event.nativeEvent)}
      onPointerDown={(event) => handlers?.onPointerDown(event.nativeEvent)}
      role="menu"
      style={getMenuStyle(surface, model.hasQuery)}
      tabIndex={-1}
    >
      <div
        {...NO_TRANSLATE}
        className="x-lumno-search-input-mode__menu-content"
        data-search-input-mode-menu-content=""
        ref={contentRef}
        role="presentation"
      >
        <MenuTiles handlers={handlers} model={model} registerButton={registerButton} />
        {model.tiles.length > 0 ? <EmptyState hidden={visibleCount > 0} text={model.labels.empty} /> : null}
      </div>
      <Footer labels={model.labels} />
    </div>
  );
}
