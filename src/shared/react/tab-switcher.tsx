import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { queryHtmlTags } from '../dom-lookup';
import { normalizeOptions } from './tab-switcher-options';
import type { NormalizedOptions, TabSwitcherTab, TabSwitcherViewOptions } from './tab-switcher-options';
import type { MouseEvent as ReactMouseEvent } from 'react';

export interface TabSwitcherThumbnailUpdate {
  tabId?: number;
  url?: string;
  thumbnail?: string;
  thumbnailStatus?: string;
  thumbnailReason?: string;
}

export type TabSwitcherTheme = 'light' | 'dark';

export interface TabSwitcherViewController {
  panel: HTMLElement | null;
  buttons: HTMLButtonElement[];
  // The panel's scheme, following the page's or the setting.
  setTheme(theme: TabSwitcherTheme): void;
  updateSelection(index: number): void;
  setTabClosing(tabId: number, closing: boolean): void;
  removeTab(tabId: number): boolean;
  updateThumbnail(
    update: TabSwitcherThumbnailUpdate
  ): { ok: boolean; reason?: string };
  destroy(): void;
}

interface InternalTab extends TabSwitcherTab {
  _previousThumbnail?: string;
  _thumbnailEntering?: boolean;
  _closing?: boolean;
}

// macOS turns a primary click with Control held into a context menu and sends
// no click. A Control shortcut keeps Control down while the switcher is open,
// so that "context menu" is the reader clicking a card. A real right click
// reports button 2 and keeps its menu.
function isControlHeldPrimaryClick(event: ReactMouseEvent): boolean {
  return event.button === 0 && event.ctrlKey;
}

function isImageDataUrl(value: unknown): boolean {
  return String(value || '').startsWith('data:image/');
}

function PreparedImage({
  className,
  src,
  alt,
  kind,
  entering,
  exiting
}: {
  className?: string;
  src: string;
  alt: string;
  kind?: string;
  entering?: boolean;
  exiting?: boolean;
}) {
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      decoding="async"
      loading="eager"
      referrerPolicy="no-referrer"
      data-kind={kind}
      data-entering={entering ? 'true' : undefined}
      data-exiting={exiting ? 'true' : undefined}
      onError={(event) => {
        event.currentTarget.setAttribute('data-broken', 'true');
        event.currentTarget.removeAttribute('src');
      }}
    />
  );
}

function TitleFavicon({
  src
}: {
  src: string;
}) {
  if (!src) {
    return <span className="x-tab-switcher-title-favicon" />;
  }
  return (
    <PreparedImage
      className="x-tab-switcher-title-favicon"
      src={src}
      alt=""
    />
  );
}

interface CardProps {
  options: NormalizedOptions;
  tab: InternalTab;
  index: number;
}

// The card's thumbnail, cross-fading from the previous one, or its site
// icon while there is none.
function CardThumbnail({ options, tab, thumbnailStatus }: Omit<CardProps, 'index'> & { thumbnailStatus: string }) {
  const thumbnail = String(tab.thumbnail || '');
  const previousThumbnail = String(tab._previousThumbnail || '');
  const favicon = String(tab.favIconUrl || '');
  return (
    <div
      className="x-tab-switcher-thumb"
      data-tab-id={String(tab.id)}
      data-thumbnail-status={thumbnailStatus}
      data-thumbnail-reason={tab.thumbnailReason ? options.sanitizeText(tab.thumbnailReason) : undefined}
    >
      {isImageDataUrl(previousThumbnail) && <PreparedImage src={previousThumbnail} alt="" kind="thumbnail" exiting />}
      {isImageDataUrl(thumbnail) ? (
        <PreparedImage src={thumbnail} alt="" kind="thumbnail" entering={Boolean(tab._thumbnailEntering)} />
      ) : (
        <div className="x-tab-switcher-fallback">
          {favicon && (
            <PreparedImage
              className="x-tab-switcher-favicon"
              src={favicon}
              alt={options.getMessage('tab_switcher_favicon_alt', 'Site icon')}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CardMeta({ options, tab, title }: Omit<CardProps, 'index'> & { title: string }) {
  const url = String(tab.url || '');
  return (
    <div className="x-tab-switcher-meta">
      <div className="x-tab-switcher-name-row">
        <TitleFavicon src={String(tab.favIconUrl || '')} />
        <div className="x-tab-switcher-name" title={title}>{title}</div>
      </div>
      <div className="x-tab-switcher-host">{options.getHostLabel(url) || url}</div>
    </div>
  );
}

function CloseButton({ options, tab, index }: CardProps) {
  const closeLabel = options.getMessage('tab_switcher_close_tab', 'Close tab');
  return (
    <button
      type="button"
      className="x-tab-switcher-close"
      aria-label={closeLabel}
      title={closeLabel}
      tabIndex={-1}
      disabled={Boolean(tab._closing)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onClose(index, event.nativeEvent);
      }}
      onContextMenu={(event) => {
        if (!isControlHeldPrimaryClick(event) || tab._closing) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        options.onClose(index, event.nativeEvent);
      }}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M3 3l6 6M9 3l-6 6" />
      </svg>
    </button>
  );
}

function TabCard({ options, tab, index, active }: CardProps & { active: boolean }) {
  const title = options.sanitizeText(tab.title, options.getMessage('tab_switcher_untitled', 'Untitled'));
  const thumbnailStatus = options.getThumbnailStatus(tab, String(tab.thumbnail || ''));
  const accent = options.normalizeAccentCss(tab.accentRgb);
  return (
    <div className="x-tab-switcher-item" data-closing={tab._closing ? 'true' : undefined}>
      <button
        type="button"
        role="option"
        className="x-tab-switcher-card"
        data-tab-id={String(tab.id)}
        data-thumbnail-status={thumbnailStatus}
        data-active={active ? 'true' : 'false'}
        aria-selected={active}
        aria-label={title}
        tabIndex={active ? 0 : -1}
        style={accent ? { '--x-tab-switcher-card-accent': accent } : undefined}
        onPointerEnter={(event) => options.onHover(index, active, event)}
        onPointerMove={(event) => options.onHover(index, active, event)}
        onFocus={() => options.onSelect(index)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onActivate(index, event.nativeEvent);
        }}
        onContextMenu={(event) => {
          if (!isControlHeldPrimaryClick(event)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          options.onActivate(index, event.nativeEvent);
        }}
      >
        <CardThumbnail options={options} tab={tab} thumbnailStatus={thumbnailStatus} />
        <CardMeta options={options} tab={tab} title={title} />
      </button>
      <CloseButton index={index} options={options} tab={tab} />
    </div>
  );
}

function TabSwitcherView({
  options,
  tabs,
  selectedIndex,
  theme,
  panelRef
}: {
  options: NormalizedOptions;
  tabs: InternalTab[];
  selectedIndex: number;
  theme: TabSwitcherTheme | null;
  panelRef: (node: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={panelRef}
      id={options.panelId}
      role="listbox"
      aria-label={options.ariaLabel}
      data-visible="true"
      data-close-placement={options.closeButtonPlacement}
      data-react-island="overlay-tab-switcher"
      data-theme={theme || undefined}
      style={{
        colorScheme: theme || undefined,
        '--x-tab-count': String(
          Math.max(1, Math.min(5, tabs.length))
        )
      }}
    >
      <div className="x-tab-switcher-list">
        {tabs.map((tab, index) => (
          <TabCard
            key={tab.id}
            options={options}
            tab={tab}
            index={index}
            active={index === selectedIndex}
          />
        ))}
      </div>
    </div>
  );
}

function createNoopController(): TabSwitcherViewController {
  return {
    panel: null,
    buttons: [],
    setTheme() {},
    updateSelection() {},
    setTabClosing() {},
    removeTab() {
      return false;
    },
    updateThumbnail() {
      return { ok: false, reason: 'react-view-unavailable' };
    },
    destroy() {}
  };
}

type ThumbnailReply = { ok: boolean; reason?: string };

// Why a captured thumbnail cannot replace a card's; null when it can.
function readThumbnailRefusal(tabs: InternalTab[], update: TabSwitcherThumbnailUpdate, index: number): string | null {
  if (!Number.isInteger(Number(update && update.tabId)) || index < 0) {
    return 'tab-not-visible';
  }
  if (!isImageDataUrl(update.thumbnail)) {
    return 'invalid-thumbnail';
  }
  const tab = tabs[index];
  const updateUrl = String(update.url || '');
  return updateUrl && tab.url && updateUrl !== tab.url ? 'tab-url-mismatch' : null;
}

class ReactTabSwitcherView implements TabSwitcherViewController {
  private tabs: InternalTab[];
  private selectedIndex: number;
  private theme: TabSwitcherTheme | null = null;
  private panelElement: HTMLElement | null = null;
  private destroyed = false;
  private readonly timers = new Set<number>();
  private readonly options: NormalizedOptions;
  private readonly mount: HTMLDivElement;
  private readonly root: Root;

  constructor(options: NormalizedOptions, rawOptions: TabSwitcherViewOptions) {
    this.options = options;
    this.mount = options.document.createElement('div');
    this.mount.setAttribute('data-react-island-owner', 'overlay-tab-switcher');
    options.root.appendChild(this.mount);
    this.root = createRoot(this.mount);
    this.tabs = (Array.isArray(rawOptions.tabs) ? rawOptions.tabs : [])
      .filter((tab) => tab && Number.isInteger(tab.id))
      .slice(0, 5)
      .map((tab) => ({ ...tab }));
    this.selectedIndex = Number(rawOptions.selectedIndex) || 0;
    this.render();
  }

  get panel(): HTMLElement | null {
    return this.panelElement;
  }

  get buttons(): HTMLButtonElement[] {
    return this.panelElement ? Array.from(queryHtmlTags(this.panelElement, '.x-tab-switcher-card', 'button')) : [];
  }

  setTheme(nextTheme: TabSwitcherTheme): void {
    if (this.theme !== nextTheme) {
      this.theme = nextTheme;
      this.render();
    }
  }

  updateSelection(index: number): void {
    this.selectedIndex = Number(index) || 0;
    this.render();
  }

  setTabClosing(tabId: number, closing: boolean): void {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    if (index < 0 || Boolean(this.tabs[index]._closing) === closing) {
      return;
    }
    this.patchTab(index, { _closing: closing });
  }

  removeTab(tabId: number): boolean {
    if (!this.tabs.some((tab) => tab.id === tabId)) {
      return false;
    }
    this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
    this.render();
    return true;
  }

  updateThumbnail(update: TabSwitcherThumbnailUpdate): ThumbnailReply {
    const tabId = Number(update && update.tabId);
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    const refusal = readThumbnailRefusal(this.tabs, update, index);
    if (refusal) {
      return { ok: false, reason: refusal };
    }
    const tab = this.tabs[index];
    const thumbnail = String(update.thumbnail || '');
    if (tab.thumbnail === thumbnail) {
      return { ok: true };
    }
    this.patchTab(index, {
      _previousThumbnail: isImageDataUrl(tab.thumbnail) ? String(tab.thumbnail) : '',
      _thumbnailEntering: true,
      thumbnail,
      thumbnailStatus: update.thumbnailStatus || 'ok',
      thumbnailReason: update.thumbnailReason || ''
    });
    this.settleThumbnail(index, tabId);
    return { ok: true };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
    this.root.unmount();
    this.mount.remove();
    this.panelElement = null;
  }

  // The new thumbnail enters on the next frame; the previous one goes once
  // it has faded out.
  private settleThumbnail(index: number, tabId: number): void {
    const windowRef = this.options.document.defaultView;
    const requestFrame = windowRef?.requestAnimationFrame?.bind(windowRef) ||
      ((callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0));
    const stillShows = (): boolean => !this.destroyed && Boolean(this.tabs[index]) && this.tabs[index].id === tabId;
    requestFrame(() => {
      if (!stillShows()) {
        return;
      }
      this.patchTab(index, { _thumbnailEntering: false });
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        if (stillShows()) {
          this.patchTab(index, { _previousThumbnail: '' });
        }
      }, 260);
      this.timers.add(timer);
    });
  }

  private patchTab(index: number, patch: Partial<InternalTab>): void {
    this.tabs[index] = { ...this.tabs[index], ...patch };
    this.render();
  }

  private render(): void {
    if (this.destroyed) {
      return;
    }
    flushSync(() => {
      this.root.render(
        <TabSwitcherView
          options={this.options}
          tabs={this.tabs}
          selectedIndex={this.selectedIndex}
          theme={this.theme}
          panelRef={(node) => {
            this.panelElement = node;
          }}
        />
      );
    });
  }
}

export function createTabSwitcherView(rawOptions: TabSwitcherViewOptions = {}): TabSwitcherViewController {
  const options = normalizeOptions(rawOptions);
  return options ? new ReactTabSwitcherView(options, rawOptions) : createNoopController();
}
