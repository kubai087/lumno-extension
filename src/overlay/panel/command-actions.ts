// What the commands and help rows that act at once do: switch the
// overlay's theme and save it, ask the background to switch the pages'
// color scheme, then draw the command row and the badge again; open the
// web clip picker, or the community QR code.
import type { OverlayThemeMode } from './overlay-theme-mode';
import type { WebAppearanceMode } from '../../domain/messages';
import { themeMode } from '../../domain/settings/appearance';
import * as LumnoMessaging from '../../platform/messaging';
import type { OverlaySettings } from '../overlay-settings';
import type { OverlayPanelElements } from './panel-elements';
import type { SlashCommands } from './slash-commands';
import type { Translate } from './types';
import * as COMMUNITY_QR_DIALOG from '../../shared/ui/community-qr-dialog';
import * as COMMUNITY_LINKS from '../../platform/community-links';

interface CommandActionsDeps extends Pick<SlashCommands,
  'isModeCommand' | 'isSlashCommandInput' | 'updateModeBadge' | 'getWebAppearanceMode' | 'setWebAppearanceState' |
  'getNextWebAppearanceMode'> {
  settings: Pick<OverlaySettings, 'set'>;
  overlayThemeChoice: Pick<OverlayThemeMode, 'apply'>;
  // Called with no rows: the list rebuilds from the typed command.
  updateSearchSuggestions(suggestions: never[], query: string): void;
  elements: Pick<OverlayPanelElements, 'searchInput' | 'overlay'>;
  removeOverlay(overlay: HTMLElement | null): void;
  t: Translate;
}

function createCommandActions(deps: CommandActionsDeps) {
  const {
    isModeCommand,
    isSlashCommandInput,
    updateModeBadge,
    getWebAppearanceMode,
    setWebAppearanceState,
    getNextWebAppearanceMode,
    settings,
    overlayThemeChoice,
    updateSearchSuggestions,
    elements,
    removeOverlay,
    t
  } = deps;

  // The WeChat group QR opens in a dialog over the page, never in a new tab.
  // The overlay closes first, as it does for any result it opens.
  function openOverlayCommunityQrDialog(qrUrl: string): void {
    const theme = elements.overlay && elements.overlay.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    removeOverlay(elements.overlay);
    COMMUNITY_QR_DIALOG.open({
      documentObj: document,
      imageUrl: qrUrl || COMMUNITY_LINKS.FALLBACK_LINKS.wechatQr,
      title: t('newtab_feedback_wechat_panel_title', 'Bug 反馈 & 新功能提需'),
      alt: t('newtab_feedback_wechat_qr_alt', 'Lumno 微信群二维码'),
      closeLabel: t('newtab_feedback_wechat_close_tooltip', '关闭'),
      theme
    });
  }

  // The web clip command: the background shows its tab picker.
  function openDocumentPipPickerFromOverlay(): void {
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openDocumentPipPicker' });
  }

  function applyThemeModeChange(mode: string): void {
    const nextMode = themeMode.parse(mode);
    void settings.set(themeMode, nextMode).catch(() => {});
    overlayThemeChoice.apply(nextMode);
    const input = elements.searchInput;
    if (input && isModeCommand(input.value || '')) {
      updateSearchSuggestions([], (input.value || '').trim());
    }
  }

  function refreshWebAppearanceCommand(): void {
    const rawValue = elements.searchInput ? (elements.searchInput.value || '') : '';
    updateModeBadge(rawValue);
    if (isSlashCommandInput(rawValue)) {
      updateSearchSuggestions([], rawValue.trim());
    }
  }

  function applyWebAppearanceState(response: { supported?: boolean; mode?: WebAppearanceMode } | undefined): void {
    if (!response || response.supported === false || typeof response.mode !== 'string') {
      return;
    }
    setWebAppearanceState({ supported: true, mode: response.mode });
    refreshWebAppearanceCommand();
  }

  function loadWebAppearanceState(): void {
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

  function applyWebAppearanceMode(mode: WebAppearanceMode): void {
    // Show the choice at once; the reply carries what Firefox kept.
    setWebAppearanceState({ supported: true, mode });
    refreshWebAppearanceCommand();
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'setWebAppearance', mode }, (response) => {
      if (!chrome.runtime.lastError && response && typeof response.mode === 'string') {
        applyWebAppearanceState(response);
        return;
      }
      loadWebAppearanceState();
    });
  }

  function applyNextWebAppearanceMode(): void {
    applyWebAppearanceMode(getNextWebAppearanceMode(getWebAppearanceMode()));
  }

  loadWebAppearanceState();

  return {
    openOverlayCommunityQrDialog,
    openDocumentPipPickerFromOverlay,
    applyThemeModeChange,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode
  };
}

export { createCommandActions };
