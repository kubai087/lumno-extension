// The tab switcher view's options, and each one's default.
import { createHoverSelection } from '../tab-switcher/hover-selection';
import type { HoverSelection } from '../tab-switcher/hover-selection';

export type TabSwitcherCloseButtonPlacement = 'left' | 'right';

export interface TabSwitcherTab {
  id: number;
  windowId?: number | null;
  title?: string;
  url?: string;
  favIconUrl?: string;
  thumbnail?: string;
  thumbnailStatus?: string;
  thumbnailReason?: string;
  accentRgb?: unknown;
}

export interface TabSwitcherViewOptions {
  document?: Document;
  root?: Element | ShadowRoot | null;
  panelId?: string;
  tabs?: TabSwitcherTab[];
  selectedIndex?: number;
  ariaLabel?: string;
  closeButtonPlacement?: TabSwitcherCloseButtonPlacement;
  sanitizeText?: (value: unknown, fallback?: string) => string;
  getHostLabel?: (url: string) => string;
  getMessage?: (key: string, fallback: string) => string;
  normalizeAccentCss?: (accent: unknown) => string;
  getThumbnailStatus?: (
    tab: TabSwitcherTab,
    thumbnail: string
  ) => string;
  onSelect?: (index: number) => void;
  onActivate?: (index: number, event: MouseEvent) => void;
  onClose?: (index: number, event: MouseEvent) => void;
}

export interface NormalizedOptions {
  document: Document;
  root: Element | ShadowRoot;
  panelId: string;
  ariaLabel: string;
  closeButtonPlacement: TabSwitcherCloseButtonPlacement;
  sanitizeText: NonNullable<TabSwitcherViewOptions['sanitizeText']>;
  getHostLabel: NonNullable<TabSwitcherViewOptions['getHostLabel']>;
  getMessage: NonNullable<TabSwitcherViewOptions['getMessage']>;
  normalizeAccentCss: NonNullable<
    TabSwitcherViewOptions['normalizeAccentCss']
  >;
  getThumbnailStatus: NonNullable<
    TabSwitcherViewOptions['getThumbnailStatus']
  >;
  onSelect: NonNullable<TabSwitcherViewOptions['onSelect']>;
  // A view is made each time the switcher opens, and so is this.
  onHover: HoverSelection;
  onActivate: NonNullable<TabSwitcherViewOptions['onActivate']>;
  onClose: NonNullable<TabSwitcherViewOptions['onClose']>;
}

export function normalizeOptions(
  raw: TabSwitcherViewOptions
): NormalizedOptions | null {
  const documentRef = raw.document || globalThis.document;
  if (!documentRef || !raw.root) {
    return null;
  }
  const onSelect = raw.onSelect || (() => {});
  return {
    document: documentRef,
    root: raw.root,
    panelId:
      raw.panelId ||
      '_x_extension_tab_switcher_panel_2026_unique_',
    ariaLabel: raw.ariaLabel || 'Recent tabs',
    closeButtonPlacement:
      raw.closeButtonPlacement === 'right' ? 'right' : 'left',
    sanitizeText:
      raw.sanitizeText ||
      ((value, fallback = '') => {
        const text = String(value || '')
          .replace(/\s+/g, ' ')
          .trim();
        return text || fallback;
      }),
    getHostLabel:
      raw.getHostLabel ||
      ((url) => {
        try {
          return new URL(url).hostname.replace(/^www\./i, '');
        } catch {
          return '';
        }
      }),
    getMessage: raw.getMessage || ((_key, fallback) => fallback),
    normalizeAccentCss: raw.normalizeAccentCss || (() => ''),
    getThumbnailStatus:
      raw.getThumbnailStatus ||
      ((_tab, thumbnail) =>
        thumbnail.startsWith('data:image/') ? 'ok' : 'missing'),
    onSelect,
    onHover: createHoverSelection(onSelect),
    onActivate: raw.onActivate || (() => {}),
    onClose: raw.onClose || (() => {})
  };
}
