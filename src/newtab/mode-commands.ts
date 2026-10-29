// Slash commands for theme, zen mode and Firefox's website appearance, and
// the setters behind them.
import type { WebAppearanceMode } from '../domain/messages';
import type { ThemeMode } from '../domain/settings';
import * as LumnoMessaging from '../platform/messaging';
import type { Suggestion } from '../shared/react/search/suggestion-list/types';
import type { FormatMessage, Translate } from './newtab-types';
import type { RenderSuggestions, SlashCommand } from './search/search-types';
import type { SettingsStore } from '../platform/settings-store';
import { NEWTAB_THEME_SETTINGS } from '../domain/settings/newtab-page';
import { newtabZenMode } from '../domain/settings/newtab-page';
import type { SettingPreview } from './setting-preview';
import { bookmarkCount } from '../domain/settings/bookmarks';
import type { SearchBoxParts } from './search/search-box-parts';
import type { AppliedThemeMode } from './theme/applied-theme-mode';
import type { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';
import { adaptiveToneEvents } from './wallpaper/tone-requests';


interface ModeCommandsDeps {
  preview: Pick<SettingPreview, 'get'>;
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  t: Translate;
  formatMessage: FormatMessage;
  updateInputRightPadding(): void;
  getExtensionResourceUrl(path: string): string;
  renderSuggestions: RenderSuggestions;
  applyNewtabTopContentVisibility(): void;
  applyNewtabShortcutsVisibility(): void;
  bookmarkSection: HTMLElement | null;
  recentSection: HTMLElement | null;
  isBookmarkTopbarMode(): boolean;
  bookmarkCards: readonly HTMLElement[];
  closeBookmarkCascadeMenu(): void;
  closeShortcutContextMenu(): void;
  closeRecentContextMenu(): void;
  closeShortcutDialog(): void;
  closeWallpaperPanel(): void;
  closeFeedbackPopover(): void;
  hideTopActionTooltip(): void;
  hideShortcutTooltip(): void;
  hideCursorTooltip(): void;
  updateBookmarkSectionPosition(): void;
  updateSearchEntryLayout(): void;
  searchBox: Pick<SearchBoxParts, 'inputParts'>;
  appliedTheme: Pick<AppliedThemeMode, 'mode'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'topbar'>;
}

const THEME_MODE_ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];
const WEB_APPEARANCE_ORDER: readonly WebAppearanceMode[] = ['auto', 'light', 'dark'];

function createModeCommands(deps: ModeCommandsDeps) {
  const {
    bookmarkParts,
    appliedTheme,
    searchBox,
    preview,
    settings,
    t,
    formatMessage,
    updateInputRightPadding,
    getExtensionResourceUrl,
    renderSuggestions,
    applyNewtabTopContentVisibility,
    applyNewtabShortcutsVisibility,
    bookmarkSection,
    recentSection,
    isBookmarkTopbarMode,
    bookmarkCards,
    closeBookmarkCascadeMenu,
    closeShortcutContextMenu,
    closeRecentContextMenu,
    closeShortcutDialog,
    closeWallpaperPanel,
    closeFeedbackPopover,
    hideTopActionTooltip,
    hideShortcutTooltip,
    hideCursorTooltip,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout
  } = deps;

  // Firefox's website appearance setting (the color scheme pages see), read
  // and switched through the background for the /appearance command.
  let webAppearanceState: { supported: boolean; mode: WebAppearanceMode } = { supported: false, mode: 'auto' };

  function getThemeModeLabel(mode: string): string {
    if (mode === 'dark') {
      return t('theme_label_dark', '深色');
    }
    if (mode === 'light') {
      return t('theme_label_light', '浅色');
    }
    return t('theme_label_system', '跟随系统');
  }

  const commandDefinitions: SlashCommand[] = [
    {
      type: 'commandNewTab',
      primary: '/new',
      aliases: ['/n', '/newtab', '/nt']
    },
    {
      type: 'commandSettings',
      primary: '/settings',
      aliases: ['/set', '/settings', '/s']
    },
    {
      type: 'modeSwitch',
      primary: '/mode',
      aliases: []
    },
    {
      type: 'zenSwitch',
      primary: '/zen',
      aliases: []
    },
    {
      type: 'webAppearanceSwitch',
      primary: '/appearance',
      aliases: [],
      requiresWebAppearance: true
    }
  ];

  function getCommandMatches(rawInput: unknown): SlashCommand[] {
    const input = String(rawInput || '').trim().toLowerCase();
    if (!input.startsWith('/')) {
      return [];
    }
    const matches: SlashCommand[] = [];
    for (let i = 0; i < commandDefinitions.length; i += 1) {
      const command = commandDefinitions[i];
      // Only Firefox has a website appearance setting to switch.
      if (command.requiresWebAppearance && !webAppearanceState.supported) {
        continue;
      }
      const tokens = [command.primary].concat(command.aliases || []);
      for (let j = 0; j < tokens.length; j += 1) {
        const token = String(tokens[j] || '').trim().toLowerCase();
        if (token.startsWith(input)) {
          matches.push(command);
          break;
        }
      }
    }
    return matches;
  }

  function getCommandMatch(rawInput: unknown): { command: SlashCommand; completion: string } | null {
    const matches = getCommandMatches(rawInput);
    return matches.length > 0
      ? {
          command: matches[0],
          completion: matches[0].primary
        }
      : null;
  }

  function buildCommandSuggestion(command: SlashCommand): Suggestion {
    if (command.type === 'modeSwitch') {
      return {
        ...buildModeSuggestion(),
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }
    if (command.type === 'zenSwitch') {
      return {
        ...buildZenSuggestion(),
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }
    if (command.type === 'webAppearanceSwitch') {
      return {
        ...buildWebAppearanceSuggestion(),
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }
    let titleText = '';
    if (command.type === 'commandSettings') {
      titleText = formatMessage('command_settings', '打开设置', {
        name: 'Lumno'
      });
    } else {
      titleText = t('command_newtab', '新建标签页');
    }
    return {
      type: command.type,
      title: titleText,
      url: '',
      commandText: command.primary,
      commandAliases: command.aliases || []
    };
  }

  function getModeBadgeText(zenCommandActive: boolean, webAppearanceCommandActive: boolean): string {
    if (webAppearanceCommandActive) {
      return formatMessage('web_appearance_badge', '网站外观：{mode}', {
        mode: getWebAppearanceModeLabel(webAppearanceState.mode)
      });
    }
    if (zenCommandActive) {
      return t(
        settings.get(newtabZenMode) ? 'zen_badge_on' : 'zen_badge_off',
        settings.get(newtabZenMode) ? 'Zen：已开启' : 'Zen：已关闭'
      );
    }
    return formatMessage('mode_badge', '模式：{mode}', {
      mode: getThemeModeLabel(appliedTheme.mode)
    });
  }

  function updateModeBadge(rawValue: string | null | undefined): void {
    const inputParts = searchBox.inputParts;
    if (!inputParts) {
      return;
    }
    const zenCommandActive = isZenCommand(rawValue || '');
    const webAppearanceCommandActive = isWebAppearanceCommand(rawValue || '');
    if (isModeCommand(rawValue || '') || zenCommandActive || webAppearanceCommandActive) {
      inputParts.setChrome({
        badgeVisible: true,
        badgeText: getModeBadgeText(zenCommandActive, webAppearanceCommandActive)
      });
    } else {
      inputParts.setChrome({ badgeVisible: false });
    }
    updateInputRightPadding();
  }

  function getNextThemeMode(mode: unknown): ThemeMode {
    const index = THEME_MODE_ORDER.findIndex((item) => item === mode);
    if (index === -1) {
      return 'light';
    }
    return THEME_MODE_ORDER[(index + 1) % THEME_MODE_ORDER.length];
  }

  function isModeCommand(input: unknown): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/mode' || raw.startsWith('/mode ');
  }

  function isZenCommand(input: unknown): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/zen' || raw.startsWith('/zen ');
  }

  function isSlashCommandInput(input: unknown): boolean {
    const raw = String(input || '').trim();
    return raw.startsWith('/');
  }

  function isWebAppearanceCommand(input: unknown): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return webAppearanceState.supported &&
      (raw === '/appearance' || raw.startsWith('/appearance '));
  }

  function getWebAppearanceModeLabel(mode: WebAppearanceMode): string {
    return mode === 'auto'
      ? t('web_appearance_label_auto', '自动')
      : getThemeModeLabel(mode);
  }

  function getNextWebAppearanceMode(mode: WebAppearanceMode): WebAppearanceMode {
    return WEB_APPEARANCE_ORDER[(WEB_APPEARANCE_ORDER.indexOf(mode) + 1) % WEB_APPEARANCE_ORDER.length];
  }

  function buildModeSuggestion(): Suggestion {
    const nextMode = getNextThemeMode(appliedTheme.mode);
    return {
      type: 'modeSwitch',
      title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
        name: 'Lumno',
        mode: getThemeModeLabel(nextMode)
      }),
      url: '',
      favicon: getExtensionResourceUrl('assets/images/lumno.png'),
      commandText: '/mode',
      commandAliases: [],
      nextMode: nextMode
    };
  }

  function buildZenSuggestion(): Suggestion {
    return {
      type: 'zenSwitch',
      title: settings.get(newtabZenMode)
        ? formatMessage('zen_disable_title', '{name}：退出 Zen 模式', { name: 'Lumno' })
        : formatMessage('zen_enable_title', '{name}：进入 Zen 模式', { name: 'Lumno' }),
      url: '',
      favicon: getExtensionResourceUrl('assets/images/lumno.png'),
      commandText: '/zen',
      commandAliases: [],
      nextEnabled: !settings.get(newtabZenMode)
    };
  }

  function buildWebAppearanceSuggestion(): Suggestion {
    const nextMode = getNextWebAppearanceMode(webAppearanceState.mode);
    return {
      type: 'webAppearanceSwitch',
      title: formatMessage('web_appearance_switch_title', '网站外观：切换到{mode}', {
        mode: getWebAppearanceModeLabel(nextMode)
      }),
      url: '',
      commandText: '/appearance',
      commandAliases: [],
      nextMode: nextMode
    };
  }

  function refreshWebAppearanceCommand(): void {
    const rawValue = searchBox.inputParts && searchBox.inputParts.input
      ? (searchBox.inputParts.input.value || '')
      : '';
    updateModeBadge(rawValue);
    if (isSlashCommandInput(rawValue)) {
      renderSuggestions([], rawValue.trim());
    }
  }

  function applyWebAppearanceState(response: { supported?: boolean; mode?: WebAppearanceMode } | undefined): void {
    if (!response || response.supported === false || typeof response.mode !== 'string') {
      return;
    }
    webAppearanceState = { supported: true, mode: response.mode };
    refreshWebAppearanceCommand();
  }

  function loadWebAppearance(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getWebAppearance' }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      applyWebAppearanceState(response);
    });
  }

  function isWebAppearanceMode(value: unknown): value is WebAppearanceMode {
    return value === 'auto' || value === 'light' || value === 'dark';
  }

  // Takes the mode a suggestion carries; anything else is ignored.
  function setWebAppearanceMode(mode: unknown): void {
    if (!isWebAppearanceMode(mode)) {
      return;
    }
    // Show the choice at once; the reply carries what Firefox kept.
    webAppearanceState = { ...webAppearanceState, mode };
    refreshWebAppearanceCommand();
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'setWebAppearance', mode }, (response) => {
      if (!chrome.runtime.lastError && response && typeof response.mode === 'string') {
        applyWebAppearanceState(response);
        return;
      }
      loadWebAppearance();
    });
  }

  function updateModeCommandSuggestions(): void {
    const input = searchBox.inputParts && searchBox.inputParts.input;
    if (input && isModeCommand(input.value)) {
      renderSuggestions([], (input.value || '').trim());
    }
  }

  function updateZenCommandSuggestions(): void {
    const input = searchBox.inputParts && searchBox.inputParts.input;
    if (input && isZenCommand(input.value)) {
      renderSuggestions([], (input.value || '').trim());
    }
  }

  function syncSectionZenVisibility(section: HTMLElement | null): void {
    if (!section) {
      return;
    }
    let configuredVisible = section.getAttribute('data-content-visible');
    if (configuredVisible !== 'true' && configuredVisible !== 'false') {
      configuredVisible = section.getAttribute('data-visible') === 'true' ? 'true' : 'false';
      section.setAttribute('data-content-visible', configuredVisible);
    }
    section.setAttribute(
      'data-visible',
      configuredVisible === 'true' && !settings.get(newtabZenMode) ? 'true' : 'false'
    );
  }

  function applyZenMode(): void {
    if (document.body) {
      document.body.setAttribute('data-zen-mode', settings.get(newtabZenMode) ? 'true' : 'false');
    }
    applyNewtabTopContentVisibility();
    applyNewtabShortcutsVisibility();
    syncSectionZenVisibility(bookmarkSection);
    syncSectionZenVisibility(recentSection);
    if (bookmarkParts.topbar && isBookmarkTopbarMode()) {
      bookmarkParts.topbar.setVisible(
        !settings.get(newtabZenMode) && bookmarkCards.length > 0 && preview.get(bookmarkCount) > 0
      );
    }
    if (settings.get(newtabZenMode)) {
      closeBookmarkCascadeMenu();
      closeShortcutContextMenu();
      closeRecentContextMenu();
      closeShortcutDialog();
      closeWallpaperPanel();
      closeFeedbackPopover();
      hideTopActionTooltip();
      hideShortcutTooltip();
      hideCursorTooltip();
    }
    updateBookmarkSectionPosition();
    updateSearchEntryLayout();
    adaptiveToneEvents.emit('stale', {});
    updateModeBadge(searchBox.inputParts && searchBox.inputParts.input ? searchBox.inputParts.input.value : '');
  }

  // Puts the page in or out of zen once the setting is read, and on every change.
  function followZenMode(): Promise<void> {
    settings.subscribe(newtabZenMode, () => {
      applyZenMode();
      updateZenCommandSuggestions();
    });
    return settings.include(newtabZenMode).then(applyZenMode);
  }

  // The theme commands show the theme as it is.
  settings.subscribe(NEWTAB_THEME_SETTINGS, () => updateModeCommandSuggestions());

  return {
    getCommandMatches,
    getCommandMatch,
    buildCommandSuggestion,
    updateModeBadge,
    getNextThemeMode,
    isModeCommand,
    isZenCommand,
    isSlashCommandInput,
    buildModeSuggestion,
    buildZenSuggestion,
    loadWebAppearance,
    setWebAppearanceMode,
    updateModeCommandSuggestions,
    updateZenCommandSuggestions,
    applyZenMode,
    followZenMode
  };
}

type ModeCommands = ReturnType<typeof createModeCommands>;

export { createModeCommands };
export type { ModeCommands, ModeCommandsDeps };
