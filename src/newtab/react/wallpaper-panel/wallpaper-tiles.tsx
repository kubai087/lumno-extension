// Wallpaper and favicon tiles: built-in, custom and online wallpapers, the
// selected source and the daily row.
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type {
  TileState,
  FaviconItem,
  WallpaperPanelActions,
  SelectedSourceState,
  DailyState,
  OnlineTileState
} from './panel-model';
import { ref, tooltipHandlers, Switch } from './panel-primitives';
import { LinkButton } from '../../../shared/react/link-button';
import { InfoButton } from './panel-controls';
import { RemixIcon } from '../../../shared/react/remix-icon';
import { SvgTree } from '../../../shared/react/svg-tree';
import { isWallpaperDeleteTarget } from '../../dom/event-targets';

export function WallpaperTile({
  onPrime,
  onSelect,
  tile
}: {
  onPrime?(): void;
  onSelect(): void;
  tile: TileState & { disabled?: boolean; tooltip?: string };
}) {
  return (
    <button
      aria-label={tile.label || undefined}
      aria-pressed={tile.selected ? 'true' : 'false'}
      className="x-nt-wallpaper-tile"
      data-selected={tile.selected ? 'true' : 'false'}
      data-wallpaper-id={tile.id}
      data-wallpaper-path={tile.path}
      disabled={tile.disabled}
      onClick={onSelect}
      onFocus={onPrime}
      onPointerDown={onPrime}
      onPointerEnter={onPrime}
      type="button"
    >
      <span className="x-nt-wallpaper-thumb">
        <img
          alt=""
          decoding="async"
          draggable={false}
          loading="lazy"
          src={tile.thumbnailUrl}
        />
      </span>
      <span
        className="x-nt-wallpaper-check"
      >
        <RemixIcon name="ri-check-line" size={16} />
      </span>
    </button>
  );
}

export function FaviconTile({
  item,
  label,
  onSelect,
  selected
}: {
  item: FaviconItem;
  label: string;
  onSelect(): void;
  selected: boolean;
}) {
  return (
    <button
      aria-label={label || undefined}
      aria-pressed={selected ? 'true' : 'false'}
      className="x-nt-wallpaper-tile x-nt-favicon-option"
      data-newtab-favicon-id={item.id}
      data-selected={selected ? 'true' : 'false'}
      onClick={onSelect}
      type="button"
    >
      <span className="x-nt-wallpaper-thumb x-nt-favicon-thumb">
        {item.inlineSvg ? (
          <span
            aria-hidden="true"
            className="x-nt-favicon-image x-nt-favicon-svg-preview"
          >
            <SvgTree node={item.inlineSvg} />
          </span>
        ) : (
          <img
            alt=""
            className="x-nt-favicon-image"
            draggable={false}
            src={item.previewUrl}
          />
        )}
      </span>
      <span
        className="x-nt-wallpaper-check"
      >
        <RemixIcon name="ri-check-line" size={16} />
      </span>
    </button>
  );
}

export const activateOnKey = (activate: () => void) => (event: ReactKeyboardEvent<HTMLElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  event.preventDefault();
  activate();
};

const isFromDeleteButton = (event: { target: EventTarget | null }) => isWallpaperDeleteTarget(event.target);

export function CustomWallpaperTile({
  actions,
  deleteLabel,
  tile
}: {
  actions: WallpaperPanelActions;
  deleteLabel: string;
  tile: TileState;
}) {
  const select = () => actions.selectWallpaper(tile.id);
  return (
    <div
      aria-label={tile.label || undefined}
      aria-pressed={tile.selected ? 'true' : 'false'}
      className="x-nt-wallpaper-tile x-nt-wallpaper-custom-tile"
      data-custom-wallpaper="true"
      data-selected={tile.selected ? 'true' : 'false'}
      data-wallpaper-id={tile.id}
      onClick={(event) => {
        if (!isFromDeleteButton(event)) select();
      }}
      onFocus={() => actions.primeWallpaper(tile.id)}
      onKeyDown={(event) => {
        if (!isFromDeleteButton(event)) activateOnKey(select)(event);
      }}
      onPointerDown={() => actions.primeWallpaper(tile.id)}
      onPointerEnter={() => actions.primeWallpaper(tile.id)}
      role="button"
      tabIndex={0}
    >
      <span className="x-nt-wallpaper-thumb">
        <img
          alt=""
          className="x-nt-wallpaper-custom-image"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={tile.thumbnailUrl}
        />
      </span>
      <span
        className="x-nt-wallpaper-check"
      >
        <RemixIcon name="ri-check-line" size={16} />
      </span>
      <button
        aria-label={deleteLabel || undefined}
        className="x-nt-wallpaper-delete-button"
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          actions.deleteWallpaper(tile.id);
        }}
        type="button"
      >
        <RemixIcon name="ri-close-line" />
      </button>
    </div>
  );
}

export function SelectedSource({ name, source }: { name: string; source: SelectedSourceState }) {
  return (
    <div {...ref(`${name}SelectedSource`)} className="x-nt-bing-source" hidden={!source.visible}>
      <LinkButton
        {...ref(`${name}SelectedLink`)}
        aria-label={source.linkLabel || undefined}
        className="x-nt-bing-source-link"
        external
        href={source.visible ? source.url : undefined}
        labelProps={ref(`${name}SelectedTitle`)}
      >
        {source.title}
      </LinkButton>
      <p {...ref(`${name}SelectedMeta`)} className="x-nt-bing-source-meta">{source.meta}</p>
    </div>
  );
}

export function DailyRow({
  actions,
  daily: state,
  name,
  onToggle
}: {
  actions: WallpaperPanelActions;
  daily: DailyState;
  name: string;
  onToggle(enabled: boolean): void;
}) {
  return (
    <div className="x-nt-wallpaper-mode-sync">
      <span className="x-nt-appearance-setting-title-group">
        <span {...ref(`${name}DailyLabel`)} className="x-nt-wallpaper-mode-sync-title">{state.label}</span>
        <InfoButton
          actions={actions}
          label={state.infoTooltip}
          name={`${name}DailyInfoButton`}
          tooltip={state.infoTooltip}
        />
      </span>
      <span className="x-nt-daily-actions">
        <button
          {...ref(`${name}DailyRestore`)}
          {...tooltipHandlers(actions, state.restoreLabel)}
          aria-label={state.restoreLabel || undefined}
          className="x-nt-panel-icon-button x-nt-daily-restore"
          hidden={!state.restoreVisible}
          onClick={() => {
            actions.hideTooltip();
            actions.restoreDailyWallpaper();
          }}
          type="button"
        >
          <RemixIcon name="ri-arrow-go-back-line" />
        </button>
        <Switch name={`${name}DailyToggle`} onChange={onToggle} toggle={state.toggle} />
      </span>
    </div>
  );
}

export function OnlineTiles({
  actions,
  name,
  onSelect,
  tiles
}: {
  actions: WallpaperPanelActions;
  name: string;
  onSelect(id: string): void;
  tiles: OnlineTileState[];
}) {
  return (
    <>
      {tiles.map((tile) => (
        <button
          {...tooltipHandlers(actions, tile.tooltip)}
          aria-label={tile.label || undefined}
          aria-pressed={tile.selected ? 'true' : 'false'}
          className="x-nt-wallpaper-tile"
          data-context-menu-open={tile.contextMenuOpen ? 'true' : undefined}
          data-selected={tile.selected ? 'true' : 'false'}
          data-wallpaper-id={tile.id}
          disabled={tile.disabled}
          key={tile.id}
          onClick={() => onSelect(tile.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            actions.hideTooltip();
            actions.openOnlineWallpaperMenu(tile.id, event.currentTarget, { x: event.clientX, y: event.clientY });
          }}
          onPointerEnter={name === 'curated' ? () => actions.primeWallpaper(tile.id) : undefined}
          type="button"
        >
          <span className="x-nt-wallpaper-thumb">
            <img
              alt=""
              decoding="async"
              draggable={false}
              loading="lazy"
              src={tile.thumbnailUrl}
            />
          </span>
          <span
            className="x-nt-wallpaper-check"
          >
            <RemixIcon name="ri-check-line" size={16} />
          </span>
        </button>
      ))}
    </>
  );
}
