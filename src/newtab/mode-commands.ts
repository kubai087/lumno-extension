// What the theme, page mode (zen, presentation) and website appearance
// commands do on the page: the mode badge in the input, the page modes, and
// the command rows kept current.
import type { Translate } from './newtab-types';
import type { RenderSuggestions } from './search/search-types';
import type { SettingsStore } from '../platform/settings-store';
import { NEWTAB_THEME_SETTINGS } from '../domain/settings/newtab-page';
import { hidesNewtabPersonalSections, newtabPresentationMode, newtabZenMode } from '../domain/settings/newtab-page';
import type { SettingPreview } from './setting-preview';
import { bookmarkCount } from '../domain/settings/bookmarks';
import type { SearchBoxParts } from './search/search-box-parts';
import type { CommandCatalog } from './search/command-catalog';
import type { WebAppearance } from './search/web-appearance';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';
import type { AppliedThemeMode } from './theme/applied-theme-mode';
import type { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';
import { adaptiveToneEvents } from './wallpaper/tone-requests';
import { bookmarkViewMode } from '../domain/settings/bookmarks';


interface ModeCommandsDeps {
  preview: Pick<SettingPreview, 'get'>;
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  t: Translate;
  renderSuggestions: RenderSuggestions;
  applyNewtabTopContentVisibility(): void;
  applyNewtabShortcutsVisibility(): void;
  bookmarkSection: HTMLElement | null;
  recentSection: HTMLElement | null;
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
  searchBox: Pick<SearchBoxParts, 'inputParts' | 'modeController'>;
  appliedTheme: Pick<AppliedThemeMode, 'events'>;
  catalog: Pick<CommandCatalog, 'getModeBadgeText' | 'getPageModeCommand' | 'isModeCommand' | 'isSlashCommandInput' | 'isWebAppearanceCommand'>;
  webAppearance: Pick<WebAppearance, 'events'>;
  locale: Pick<SurfaceLocale, 'store'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'topbar'>;
}

function createModeCommands(deps: ModeCommandsDeps) {
  const {
    bookmarkParts,
    appliedTheme,
    catalog,
    webAppearance,
    locale,
    searchBox,
    preview,
    settings,
    renderSuggestions,
    applyNewtabTopContentVisibility,
    applyNewtabShortcutsVisibility,
    bookmarkSection,
    recentSection,
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

  function updateModeBadge(rawValue: string | null | undefined): void {
    const inputParts = searchBox.inputParts;
    if (!inputParts) {
      return;
    }
    const pageMode = catalog.getPageModeCommand(rawValue || '');
    const webAppearanceCommandActive = catalog.isWebAppearanceCommand(rawValue || '');
    if (catalog.isModeCommand(rawValue || '') || pageMode || webAppearanceCommandActive) {
      inputParts.chrome.setState({
        badgeVisible: true,
        badgeText: catalog.getModeBadgeText(pageMode, webAppearanceCommandActive)
      });
    } else {
      inputParts.chrome.setState({ badgeVisible: false });
    }
    if (searchBox.modeController) {
      searchBox.modeController.updateLayout();
    }
  }

  // The badge and command rows show the website appearance as it is.
  function refreshWebAppearanceCommand(): void {
    const rawValue = searchBox.inputParts && searchBox.inputParts.input
      ? (searchBox.inputParts.input.value || '')
      : '';
    updateModeBadge(rawValue);
    if (catalog.isSlashCommandInput(rawValue)) {
      renderSuggestions([], rawValue.trim());
    }
  }

  function updateModeCommandSuggestions(): void {
    const input = searchBox.inputParts && searchBox.inputParts.input;
    if (input && catalog.isModeCommand(input.value)) {
      renderSuggestions([], (input.value || '').trim());
    }
  }

  function updatePageModeCommandSuggestions(): void {
    const input = searchBox.inputParts && searchBox.inputParts.input;
    if (input && catalog.getPageModeCommand(input.value)) {
      renderSuggestions([], (input.value || '').trim());
    }
  }

  function syncSectionPageModeVisibility(section: HTMLElement | null): void {
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
      configuredVisible === 'true' && !hidesNewtabPersonalSections(settings) ? 'true' : 'false'
    );
  }

  function applyPageModes(): void {
    if (document.body) {
      document.body.setAttribute('data-zen-mode', settings.get(newtabZenMode) ? 'true' : 'false');
    }
    applyNewtabTopContentVisibility();
    applyNewtabShortcutsVisibility();
    syncSectionPageModeVisibility(bookmarkSection);
    syncSectionPageModeVisibility(recentSection);
    if (bookmarkParts.topbar && settings.get(bookmarkViewMode) === 'top') {
      bookmarkParts.topbar.setVisible(
        !hidesNewtabPersonalSections(settings) && bookmarkCards.length > 0 && preview.get(bookmarkCount) > 0
      );
    }
    if (hidesNewtabPersonalSections(settings)) {
      closeBookmarkCascadeMenu();
      closeRecentContextMenu();
    }
    if (settings.get(newtabZenMode)) {
      closeShortcutContextMenu();
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

  // Puts the page in or out of zen and presentation mode once the settings
  // are read, and on every change.
  function followPageModes(): Promise<void> {
    const pageModes = [newtabZenMode, newtabPresentationMode];
    settings.subscribe(pageModes, () => {
      applyPageModes();
      updatePageModeCommandSuggestions();
    });
    return settings.include(pageModes).then(applyPageModes);
  }

  // The theme commands show the theme as it is.
  settings.subscribe(NEWTAB_THEME_SETTINGS, () => updateModeCommandSuggestions());
  webAppearance.events.on('changed', refreshWebAppearanceCommand);
  // The badge reads the theme drawn and the page's language.
  appliedTheme.events.on('changed', () => updateModeBadge(searchBox.inputParts ? searchBox.inputParts.input.value : ''));
  locale.store.subscribe(() => updateModeBadge(searchBox.inputParts ? searchBox.inputParts.input.value : ''));

  return {
    updateModeBadge,
    updateModeCommandSuggestions,
    updatePageModeCommandSuggestions,
    applyPageModes,
    followPageModes
  };
}

type ModeCommands = ReturnType<typeof createModeCommands>;

export { createModeCommands };
export type { ModeCommands, ModeCommandsDeps };
