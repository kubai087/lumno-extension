// The controls inside the search box: the settings menu button, the clear
// button, close other tabs, the input's right padding, and which action
// buttons the page shows.
import type { SiteSearchProvider } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { FormatMessage, Translate } from '../newtab-types';
import type { PageNavigation } from '../page-navigation';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { newtabAppearanceButtonVisible, newtabFeedbackButtonVisible } from '../../domain/settings/newtab-page';
import type { SettingsStore } from '../../platform/settings-store';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import * as EXTENSION_ROUTES from '../../domain/extension-routes';
import * as FEATURE_HINTS from '../../shared/ui/feature-hints';
import { getPagePortals } from '../app/portals';
import type { SearchBoxParts } from './search-box-parts';
import type { PageNoticeControllers } from '../notice-controllers';

interface SearchBoxControlsState {
  wallpaperRuntime: unknown;
  wallpaperControl: HTMLElement | null;
}

interface SearchBoxControlsDeps {
  searchMode: SearchMode<SiteSearchProvider>;
  settings: Pick<SettingsStore, 'get' | 'include' | 'subscribe'>;
  locale: Pick<SurfaceLocale, 'store'>;
  dismissHelpCenterAskHint(): void;
  rightIcon: HTMLElement | null;
  formatMessage: FormatMessage;
  dismissWebdavFeatureHint(): void;
  getExtensionResourceUrl(resourcePath: string): string;
  // Settles with whether the Help Center tip is showing.
  helpCenterAskHintSettled: Promise<boolean>;
  t: Translate;
  getOpenDisposition: PageNavigation['getOpenDisposition'];
  searchInput: HTMLInputElement;
  closeFeedbackPopover(): void;
  closeWallpaperPanel(): void;
  searchBox: Pick<SearchBoxParts, 'inputParts' | 'modeController'>;
  notices: Pick<PageNoticeControllers, 'engagement' | 'mountWebdavHint' | 'webdavHint'>;
  pageState: SearchBoxControlsState;
  getFeedbackControl(): HTMLElement | null;
}

function createSearchBoxControls(deps: SearchBoxControlsDeps) {
  const {
    notices,
    searchBox,
    searchMode,
    settings,
    locale,
    dismissHelpCenterAskHint,
    rightIcon,
    formatMessage,
    dismissWebdavFeatureHint,
    getExtensionResourceUrl,
    helpCenterAskHintSettled,
    t,
    getOpenDisposition,
    searchInput,
    closeFeedbackPopover,
    closeWallpaperPanel,
    getFeedbackControl
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The search box exists before this module is created.
  const inputParts = searchBox.inputParts;
  if (!inputParts) {
    throw new Error('Search input unavailable');
  }

  inputParts.input.addEventListener('input', function() {
    // Typing a question in the Help Center search means the tip has done its job.
    if (searchMode.site && SearchSiteSearchProviders.isHelpCenterSiteSearchProvider(searchMode.site)) {
      dismissHelpCenterAskHint();
    }
  });

  inputParts.input.addEventListener('input', function() {
    const notice = notices.engagement;
    if (!String(inputParts.input.value || '').trim() ||
        !notice || !notice.recordMeaningfulUse) {
      return;
    }
    notice.recordMeaningfulUse();
  });

  if (rightIcon) {
    const settingsTooltipText = (): string => formatMessage(
      'command_settings',
      '打开设置',
      { name: 'Lumno' }
    );
    const applySettingsTooltip = () => {
      inputParts.setChrome({ rightIconLabel: settingsTooltipText() });
    };
    applySettingsTooltip();
    locale.store.subscribe(applySettingsTooltip);
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      dismissWebdavFeatureHint();
      const runtime = typeof chrome !== 'undefined' && chrome && chrome.runtime
        ? chrome.runtime
        : null;
      if (runtime && typeof runtime.openOptionsPage === 'function') {
        runtime.openOptionsPage();
        return;
      }
      const optionsUrl = runtime &&
          typeof runtime.getURL === 'function'
        ? EXTENSION_ROUTES.buildOptionsUrl(chrome)
        : getExtensionResourceUrl('src/options/options.html');
      window.open(optionsUrl, '_blank');
    });
    // Above the settings icon, point to WebDAV sync under Account & sync until it is dismissed.
    // It shares the space above the input with the Help Center tip, so it waits its turn.
    if (document.documentElement.getAttribute('data-nt-focus-route-pending') !== 'true') {
      const hint = FEATURE_HINTS.createFeatureHint({
        portals: getPagePortals(),
        documentObj: document,
        windowObj: window,
        chromeApi: chrome,
        definition: 'newtab-webdav-sync',
        visibilityGate: helpCenterAskHintSettled,
        initiallyVisible: false,
        t,
        onLinkClick(event) {
          dismissWebdavFeatureHint();
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
            action: 'openOptionsPage',
            hash: 'account',
            disposition: getOpenDisposition(event, 'newTab')
          });
        }
      });
      notices.mountWebdavHint(hint);
      if (hint) {
        inputParts.container.appendChild(hint.element);
        helpCenterAskHintSettled.then((helpTipShowing) => {
          if (!helpTipShowing && notices.webdavHint) {
            notices.webdavHint.setVisible(true);
          }
        });
      }
    }
  }

  const searchClearButton = inputParts.clearAction;
  if (searchClearButton) {
    const searchClearTooltipText = (): string => t('search_input_clear', '清空');
    const applySearchClearTooltip = () => {
      inputParts.setChrome({ clearLabel: searchClearTooltipText() });
    };
    applySearchClearTooltip();
    locale.store.subscribe(applySearchClearTooltip);
    searchInput.addEventListener('input', updateInputRightPadding);
  }

  const closeOtherTabsButton = inputParts.secondaryAction;
  if (closeOtherTabsButton) {
    const closeOtherTabsTooltipText = (): string => t('overlay_close_other_tabs_tooltip', '关闭其他标签页');
    const applyCloseOtherTabsTooltip = () => {
      inputParts.setChrome({ secondaryLabel: closeOtherTabsTooltipText() });
    };
    applyCloseOtherTabsTooltip();
    locale.store.subscribe(applyCloseOtherTabsTooltip);
  }

  function updateInputRightPadding(): void {
    if (searchBox.modeController) {
      searchBox.modeController.updateLayout();
    }
  }

  function setNewtabActionControlVisibility(element: HTMLElement | null, visible: boolean): void {
    if (!element) {
      return;
    }
    const nextVisible = visible !== false;
    element.hidden = !nextVisible;
    element.style.setProperty('display', nextVisible ? '' : 'none');
    element.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
    element.inert = !nextVisible;
    if (nextVisible) {
      element.removeAttribute('inert');
    } else {
      element.setAttribute('inert', '');
    }
  }

  function applyNewtabActionButtonVisibility(): void {
    if (!settings.get(newtabFeedbackButtonVisible) && getFeedbackControl()) {
      closeFeedbackPopover();
    }
    if (!settings.get(newtabAppearanceButtonVisible) && pageState.wallpaperRuntime) {
      closeWallpaperPanel();
    }
    setNewtabActionControlVisibility(getFeedbackControl(), settings.get(newtabFeedbackButtonVisible));
    setNewtabActionControlVisibility(pageState.wallpaperControl, settings.get(newtabAppearanceButtonVisible));
  }

  // Shows or hides the buttons once their settings are read, and on every change.
  function followNewtabActionButtonVisibility(): Promise<void> {
    const buttons = [newtabFeedbackButtonVisible, newtabAppearanceButtonVisible];
    settings.subscribe(buttons, applyNewtabActionButtonVisibility);
    return settings.include(buttons).then(applyNewtabActionButtonVisibility);
  }

  return {
    updateInputRightPadding,
    followNewtabActionButtonVisibility
  };
}

type SearchBoxControls = ReturnType<typeof createSearchBoxControls>;

export { createSearchBoxControls };
export type { SearchBoxControls, SearchBoxControlsDeps, SearchBoxControlsState };
