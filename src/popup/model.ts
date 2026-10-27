// What the popup shows, derived from its state: the page card and its
// actions, the quick settings, the footer links and the WebDAV status.
import type { ThemeMode } from '../domain/settings/appearance';
import type { OverlaySizeMode } from '../domain/settings/overlay-panel';
import type { RemixIconName } from '../shared/ui/remix-icon';
import type {
  PopupActionId,
  PopupActionModel,
  PopupActionPanelModel,
  PopupLinkModel,
  PopupModel,
  PopupNoticeModel,
  PopupSectionModel,
  PopupSyncModel
} from './react/popup-view';

type Translate = (key: string, fallback: string) => string;

// The tab the popup was opened on.
interface PopupTab {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  iconUrl?: string;
  iconName?: RemixIconName | null;
  host?: string;
}

// The settings the popup shows, by row id.
interface PopupSettingValues {
  selectionQuickActions: boolean;
  overlaySize: OverlaySizeMode;
  overlayPageTheme: boolean;
  overlayOpenTabs: boolean;
  theme: ThemeMode;
  autoPip: boolean;
}

type PopupSettingId = keyof PopupSettingValues;

// WebDAV's status as the worker stores it, read as untrusted.
interface PopupSyncStatus {
  enabled: boolean;
  state: string;
  error: string;
  lastSyncAt: number | null;
}

// The page among the New Tab's pinned recent sites.
interface PopupRecentPin {
  pinned: boolean;
  full: boolean;
}

interface PopupState {
  tab: PopupTab | null;
  // Browser, store and other pages scripts cannot reach.
  restricted: boolean;
  // The browser has Document Picture-in-Picture.
  documentPipSupported: boolean;
  // Web clip is turned on in Labs.
  documentPipEnabled: boolean;
  // Formatted key chords.
  shortcuts: { search: string; copy: string };
  recentPin: PopupRecentPin | null;
  settings: PopupSettingValues;
  // The settings disclosure is open.
  settingsExpanded: boolean;
  // The page's video and the auto picture-in-picture switch.
  pip: { supported: boolean; hasVideo: boolean; active: boolean; menuExpanded: boolean };
  syncStatus: PopupSyncStatus | null;
  version: string;
  lang: string;
  now: number;
  busyAction: PopupActionId | '';
  notice: PopupNoticeModel | null;
}

interface PageDescription {
  kind: 'lumno' | 'browser' | 'extension' | 'file' | 'web';
  // Extension-relative.
  iconPath: string;
  // Pages with an icon image draw no glyph.
  iconName: RemixIconName | null;
  host: string;
}

// What tells Lumno's own pages and the browser's pages apart.
interface PageOrigins {
  ownBase?: string;
  browserName?: string;
  isBrowserInternalUrl?(url: string): boolean;
}

const SYNC_ATTENTION_STATES: readonly string[] = Object.freeze(['conflict', 'choice']);
const SYNC_BUSY_STATES: readonly string[] = Object.freeze(['syncing', 'pending']);
// Rate limits the background waits out for minutes to hours before retrying.
const SYNC_THROTTLE_ERRORS: readonly string[] = Object.freeze(['http-429', 'http-503']);

function getHost(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.hostname;
    }
  } catch (error) {
    return '';
  }
  return url;
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || ''));
}

// Browser logos shipped in assets/images/browser-logos, matched against the
// browser's product name.
const BROWSER_LOGOS: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/edge/i, 'microsoft-edge-2019.svg'],
  [/zen/i, 'zen.svg'],
  [/firefox/i, 'firefox.svg'],
  [/\bdia\b/i, 'dia.jpg'],
  [/comet/i, 'comet.jpg'],
  [/chrome/i, 'google-chrome-2022.svg']
]);

// How the page card shows a tab: Lumno's own pages carry the Lumno icon,
// browser pages the browser's logo, other pages their favicon.
function describePage(url: string, origins?: PageOrigins | null): PageDescription {
  const config = origins || {};
  if (config.ownBase && url.startsWith(config.ownBase)) {
    return { kind: 'lumno', iconPath: 'assets/images/lumno.png', iconName: null, host: 'Lumno' };
  }
  if (typeof config.isBrowserInternalUrl === 'function' && config.isBrowserInternalUrl(url)) {
    const logo = BROWSER_LOGOS.find(([pattern]) => pattern.test(String(config.browserName || '')));
    return {
      kind: 'browser',
      iconPath: logo ? `assets/images/browser-logos/${logo[1]}` : '',
      iconName: logo ? null : 'ri-window-line',
      host: url
    };
  }
  if (/^(?:chrome|moz|edge)-extension:/i.test(url)) {
    return { kind: 'extension', iconPath: '', iconName: 'ri-puzzle-line', host: getHost(url) };
  }
  if (/^file:/i.test(url)) {
    return { kind: 'file', iconPath: '', iconName: 'ri-file-line', host: url };
  }
  return { kind: 'web', iconPath: '', iconName: 'ri-global-line', host: getHost(url) };
}

// "3 minutes ago" in the popup's language, "now" under a minute.
function formatSyncTime(lastSyncAt: number, now: number, lang: string): string {
  const elapsedSeconds = Math.max(0, Math.round((now - lastSyncAt) / 1000));
  let format: Intl.RelativeTimeFormat;
  try {
    format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  } catch (error) {
    format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  if (elapsedSeconds < 60) return format.format(0, 'second');
  const minutes = Math.round(elapsedSeconds / 60);
  if (minutes < 60) return format.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, 'hour');
  return format.format(-Math.round(hours / 24), 'day');
}

function buildSyncModel(status: PopupSyncStatus | null, t: Translate, now: number, lang: string): PopupSyncModel | null {
  if (!status || status.enabled !== true) {
    return null;
  }
  if (status.state === 'error') {
    return { label: t('popup_sync_error', 'WebDAV sync failed'), tone: 'error' };
  }
  if (SYNC_ATTENTION_STATES.includes(status.state)) {
    return { label: t('popup_sync_attention', 'WebDAV sync needs you'), tone: 'error' };
  }
  // A throttled connection is pending too, but nothing runs until the server's
  // wait is over, so it must not look like a sync in progress.
  if (status.state === 'pending' && SYNC_THROTTLE_ERRORS.includes(status.error)) {
    return { label: t('popup_sync_waiting', 'WebDAV waiting to retry'), tone: 'waiting' };
  }
  if (SYNC_BUSY_STATES.includes(status.state)) {
    return { label: t('popup_sync_busy', 'WebDAV syncing'), tone: 'busy' };
  }
  if (status.lastSyncAt !== null && status.lastSyncAt > 0) {
    return {
      label: `${t('popup_sync_ready', 'WebDAV synced')} · ${formatSyncTime(status.lastSyncAt, now, lang)}`,
      tone: 'ok'
    };
  }
  return null;
}

// Video picture-in-picture runs in the page, so browser pages never get it.
function showsPip(state: PopupState): boolean {
  return state.pip.supported === true && Boolean(state.tab) && !state.restricted;
}

function buildPipAction(state: PopupState, t: Translate): Omit<PopupActionModel, 'id'> {
  const pip = state.pip;
  return {
    label: pip.active
      ? t('popup_action_pip_exit', 'Exit picture-in-picture')
      : t('popup_action_pip', 'Picture-in-picture'),
    // Without a video the button is simply off; it needs no explanation.
    tooltip: pip.hasVideo || pip.active
      ? t('popup_action_pip_tooltip', 'Float this page’s video in a small window')
      : '',
    iconName: 'ri-picture-in-picture-2-line',
    disabled: !pip.hasVideo && !pip.active,
    menu: {
      label: t('popup_action_pip_menu', 'Auto picture-in-picture'),
      expanded: pip.menuExpanded === true
    }
  };
}

// Pinning holds web pages only, up to the New Tab's limit of pinned cards.
function buildPinAction(state: PopupState, t: Translate, canSaveToNewTab: boolean, unavailable: string): Omit<PopupActionModel, 'id'> {
  const pinned = Boolean(state.recentPin && state.recentPin.pinned === true);
  const pinFull = !pinned && Boolean(state.recentPin && state.recentPin.full === true);
  let tooltip = t('popup_action_pin_recent_tooltip', 'Pin to Recent on New Tab');
  if (!canSaveToNewTab) {
    tooltip = unavailable;
  } else if (pinned) {
    tooltip = t('popup_action_unpin_recent_tooltip', 'Unpin from Recent on New Tab');
  } else if (pinFull) {
    tooltip = t('recent_pin_limit', 'You can pin up to 3 cards');
  }
  return {
    label: pinned
      ? t('popup_action_unpin_recent', 'Unpin from Recent')
      : t('popup_action_pin_recent', 'Pin to Recent'),
    tooltip,
    iconName: pinned ? 'ri-unpin-line' : 'ri-pushpin-line',
    disabled: !canSaveToNewTab || pinFull
  };
}

function buildActions(state: PopupState, t: Translate): PopupActionModel[] {
  const tab = state.tab;
  const url = tab ? String(tab.url || '') : '';
  const restricted = !tab || state.restricted === true;
  // Shortcuts and pinned recent sites hold web pages only. They only store the
  // address, so a store page that takes no scripts can still be saved.
  const canSaveToNewTab = Boolean(tab) && isWebUrl(url);
  // A disabled action says why in its tooltip.
  const unavailable = t('popup_action_unavailable', 'Not available on this page');
  const action = (id: PopupActionId, base: Omit<PopupActionModel, 'id'>): PopupActionModel => ({
    ...base,
    id,
    disabled: base.disabled || state.busyAction === id
  });
  const actions: PopupActionModel[] = [
    action('search', {
      label: t('popup_open_command_bar', 'Open command bar'),
      tooltip: state.shortcuts.search,
      iconName: 'ri-search-line',
      disabled: !tab
    }),
    action('copy', {
      label: t('popup_action_copy', 'Copy link'),
      tooltip: state.shortcuts.copy,
      iconName: 'ri-link',
      disabled: !url
    }),
    action('shortcut', {
      label: t('popup_action_shortcut', 'Add shortcut'),
      tooltip: canSaveToNewTab ? t('popup_action_shortcut_tooltip', 'Add to your New Tab shortcuts') : unavailable,
      iconName: 'ri-apps-2-add-line',
      disabled: !canSaveToNewTab
    }),
    action('pin', buildPinAction(state, t, canSaveToNewTab, unavailable))
  ];
  // Web clip is a Labs feature: it only shows once it is turned on.
  if (state.documentPipSupported === true && state.documentPipEnabled === true) {
    actions.push(action('clip', {
      label: t('settings_document_pip_title', 'Web clip'),
      tooltip: restricted ? unavailable : t('popup_action_clip_tooltip', 'Clip part of the page into a floating window'),
      iconName: 'ri-screenshot-2-line',
      disabled: restricted
    }));
  }
  if (showsPip(state)) {
    actions.push(action('pip', buildPipAction(state, t)));
  }
  return actions;
}

function buildActionPanel(state: PopupState, t: Translate): PopupActionPanelModel | null {
  if (!showsPip(state)) {
    return null;
  }
  return {
    actionId: 'pip',
    expanded: state.pip.menuExpanded === true,
    rows: [{
      kind: 'switch',
      id: 'autoPip',
      label: t('popup_action_pip_menu', 'Auto picture-in-picture'),
      hint: t('popup_auto_pip_hint', 'Videos float when you switch tabs'),
      checked: state.settings.autoPip === true
    }]
  };
}

function buildSettingSections(values: PopupSettingValues, t: Translate): PopupSectionModel[] {
  return [
    {
      id: 'command-bar',
      title: t('popup_section_command_bar', 'Command bar'),
      rows: [
        {
          kind: 'segmented',
          id: 'overlaySize',
          label: t('settings_overlay_size_title', 'Size'),
          value: values.overlaySize,
          options: [
            { value: 'compact', label: t('overlay_size_compact', 'Compact') },
            { value: 'standard', label: t('overlay_size_standard', 'Standard') },
            { value: 'large', label: t('overlay_size_large', 'Large') }
          ]
        },
        {
          kind: 'switch',
          id: 'overlayPageTheme',
          label: t('popup_overlay_page_theme', 'Match page colors'),
          checked: values.overlayPageTheme === true
        },
        {
          kind: 'switch',
          id: 'overlayOpenTabs',
          label: t('popup_overlay_open_tabs', 'Show open tabs by default'),
          checked: values.overlayOpenTabs === true
        }
      ]
    },
    {
      id: 'general',
      title: t('settings_tab_general', 'General'),
      rows: [
        {
          kind: 'switch',
          id: 'selectionQuickActions',
          label: t('settings_selection_quick_actions_title', 'Selection quick actions'),
          checked: values.selectionQuickActions === true
        },
        {
          kind: 'segmented',
          id: 'theme',
          label: t('popup_theme_label', 'Theme'),
          value: values.theme,
          options: [
            { value: 'system', label: t('settings_theme_system', 'System') },
            { value: 'light', label: t('settings_theme_light', 'Light') },
            { value: 'dark', label: t('settings_theme_dark', 'Dark') }
          ]
        }
      ]
    }
  ];
}

function buildLinks(t: Translate): PopupLinkModel[] {
  return [
    { id: 'release', label: t('popup_release_notes', 'What’s new'), iconName: 'ri-sparkling-2-line' },
    { id: 'feedback', label: t('popup_link_feedback', 'Feedback'), iconName: 'ri-chat-smile-2-line' },
    { id: 'shortcuts', label: t('popup_link_shortcuts', 'Set shortcuts'), iconName: 'ri-keyboard-box-line' },
    { id: 'settings', label: t('popup_link_settings', 'Settings'), iconName: 'ri-settings-3-line' }
  ];
}

function buildModel(state: PopupState, t: Translate): PopupModel {
  const tab = state.tab;
  const url = tab ? String(tab.url || '') : '';
  return {
    page: {
      title: tab ? String(tab.title || getHost(url) || url) : 'Lumno',
      host: tab ? (tab.host === undefined ? getHost(url) : String(tab.host)) : '',
      iconUrl: tab ? String(tab.iconUrl || '') : '',
      iconName: (tab && tab.iconName) || 'ri-global-line'
    },
    actionsLabel: t('popup_actions_label', 'Page actions'),
    actions: buildActions(state, t),
    actionPanel: buildActionPanel(state, t),
    notice: state.notice || null,
    settings: {
      label: t('popup_settings_label', 'Quick settings'),
      expanded: state.settingsExpanded === true,
      sections: buildSettingSections(state.settings, t)
    },
    links: buildLinks(t),
    sync: buildSyncModel(state.syncStatus, t, state.now, state.lang),
    version: `Lumno ${state.version || ''}`.trim()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readSyncStatus(value: unknown): PopupSyncStatus | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    enabled: value.enabled === true,
    state: typeof value.state === 'string' ? value.state : '',
    error: typeof value.error === 'string' ? value.error : '',
    lastSyncAt: typeof value.lastSyncAt === 'number' && Number.isFinite(value.lastSyncAt) ? value.lastSyncAt : null
  };
}

export { buildModel, describePage, formatSyncTime, isRecord, isWebUrl, readSyncStatus };
export type {
  PageDescription,
  PageOrigins,
  PopupRecentPin,
  PopupSettingId,
  PopupSettingValues,
  PopupState,
  PopupSyncStatus,
  PopupTab,
  Translate
};
