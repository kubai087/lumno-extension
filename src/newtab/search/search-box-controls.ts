// The controls inside the search box: the settings menu button, the clear
// button, close other tabs, the input's right padding, and which action
// buttons the page shows.
import type * as ExtensionRoutes from '../../domain/extension-routes';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { StorageAreaLike, StorageItems } from '../../domain/storage-port';
import * as LumnoMessaging from '../../platform/messaging';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type * as FeatureHints from '../../shared/ui/feature-hints';
import type { FeatureHintController } from '../../shared/ui/feature-hint-catalog';
import type { FormatMessage, Translate } from '../newtab-types';
import type { PageNavigation } from '../page-navigation';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as SettingsStorage from '../../platform/settings-storage';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';

interface SearchBoxControlsState {
  inputParts: SearchInputParts | null;
  siteSearchState: SiteSearchProvider | null;
  // Counts the uses the review notice waits for.
  engagementNoticeController: { recordMeaningfulUse?(): void } | null;
  webdavFeatureHintController: FeatureHintController | null;
  inputModeController: Pick<InputModeController, 'updateLayout'> | null;
  newtabFeedbackButtonVisible: boolean;
  newtabAppearanceButtonVisible: boolean;
  feedbackReactController: unknown;
  wallpaperRuntime: unknown;
  feedbackControl: HTMLElement | null;
  wallpaperControl: HTMLElement | null;
}

interface SearchBoxControlsDeps {
  locale: Pick<SurfaceLocale, 'store'>;
  dismissHelpCenterAskHint(): void;
  rightIcon: HTMLElement | null;
  formatMessage: FormatMessage;
  // Runs the listener again whenever the page language changes.
  dismissWebdavFeatureHint(): void;
  EXTENSION_ROUTES: Pick<typeof ExtensionRoutes, 'buildOptionsUrl'>;
  getExtensionResourceUrl(resourcePath: string): string;
  FEATURE_HINTS: Pick<typeof FeatureHints, 'createFeatureHint'>;
  // Settles with whether the Help Center tip is showing.
  helpCenterAskHintSettled: Promise<boolean>;
  t: Translate;
  getOpenDisposition: PageNavigation['getOpenDisposition'];
  searchInput: HTMLInputElement;
  closeFeedbackPopover(): void;
  closeWallpaperPanel(): void;
  storageArea: StorageAreaLike | null;
  NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY: string;
  NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY: string;
  normalizeNewtabFeedbackButtonVisible(value: unknown): boolean;
  normalizeNewtabAppearanceButtonVisible(value: unknown): boolean;
  pageState: SearchBoxControlsState;
}

function createSearchBoxControls(deps: SearchBoxControlsDeps) {
  const {
    locale,
    dismissHelpCenterAskHint,
    rightIcon,
    formatMessage,
    dismissWebdavFeatureHint,
    EXTENSION_ROUTES,
    getExtensionResourceUrl,
    FEATURE_HINTS,
    helpCenterAskHintSettled,
    t,
    getOpenDisposition,
    searchInput,
    closeFeedbackPopover,
    closeWallpaperPanel,
    storageArea,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
    normalizeNewtabFeedbackButtonVisible,
    normalizeNewtabAppearanceButtonVisible
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The search box exists before this module is created.
  const inputParts = pageState.inputParts;
  if (!inputParts) {
    throw new Error('Search input unavailable');
  }

  inputParts.input.addEventListener('input', function() {
    // Typing a question in the Help Center search means the tip has done its job.
    if (pageState.siteSearchState && SearchSiteSearchProviders.isHelpCenterSiteSearchProvider(pageState.siteSearchState)) {
      dismissHelpCenterAskHint();
    }
  });

  inputParts.input.addEventListener('input', function() {
    const notice = pageState.engagementNoticeController;
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
      pageState.webdavFeatureHintController = hint;
      if (hint) {
        inputParts.container.appendChild(hint.element);
        helpCenterAskHintSettled.then((helpTipShowing) => {
          if (!helpTipShowing && pageState.webdavFeatureHintController) {
            pageState.webdavFeatureHintController.setVisible(true);
          }
        });
      }
    }
  }

  const searchClearButton = inputParts.clearAction;
  // Width the clear button adds left of the close-other-tabs button: 30px button + 6px gap.
  const SEARCH_CLEAR_BUTTON_INSET = 36;
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
    if (pageState.inputModeController) {
      pageState.inputModeController.updateLayout();
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
    if (!pageState.newtabFeedbackButtonVisible && pageState.feedbackReactController) {
      closeFeedbackPopover();
    }
    if (!pageState.newtabAppearanceButtonVisible && pageState.wallpaperRuntime) {
      closeWallpaperPanel();
    }
    setNewtabActionControlVisibility(pageState.feedbackControl, pageState.newtabFeedbackButtonVisible);
    setNewtabActionControlVisibility(pageState.wallpaperControl, pageState.newtabAppearanceButtonVisible);
  }

  function loadNewtabActionButtonVisibility(): Promise<void> {
    if (!storageArea) {
      pageState.newtabFeedbackButtonVisible = true;
      pageState.newtabAppearanceButtonVisible = true;
      applyNewtabActionButtonVisibility();
      return Promise.resolve();
    }
    // Narrowed here, for the storage callback below.
    const area = storageArea;
    return new Promise((resolve) => {
      void area.get([
        NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
        NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY
      ], (result) => {
        const stored = result || {};
        const rawFeedback = stored[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY];
        const rawAppearance = stored[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY];
        pageState.newtabFeedbackButtonVisible = normalizeNewtabFeedbackButtonVisible(rawFeedback);
        pageState.newtabAppearanceButtonVisible = normalizeNewtabAppearanceButtonVisible(rawAppearance);
        const repairs: StorageItems = {};
        if (rawFeedback !== pageState.newtabFeedbackButtonVisible) {
          repairs[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY] = pageState.newtabFeedbackButtonVisible;
        }
        if (rawAppearance !== pageState.newtabAppearanceButtonVisible) {
          repairs[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY] = pageState.newtabAppearanceButtonVisible;
        }
        applyNewtabActionButtonVisibility();
        // A missing value stays missing while this device's local copy
        // migrates in.
        SettingsStorage.writeSettingRepairs(chrome, area, repairs, stored);
        resolve();
      });
    });
  }

  return {
    SEARCH_CLEAR_BUTTON_INSET,
    updateInputRightPadding,
    applyNewtabActionButtonVisibility,
    loadNewtabActionButtonVisibility
  };
}

type SearchBoxControls = ReturnType<typeof createSearchBoxControls>;

export { createSearchBoxControls };
export type { SearchBoxControls, SearchBoxControlsDeps, SearchBoxControlsState };
