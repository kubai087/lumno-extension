// Notices on the page: the update notice and its session slot, the graphics
// acceleration notice, the engagement notice, the help center ask hint and community QR dialog, the
// file access notice and the page notice banner, and the WebDAV hint.
import * as ENGAGEMENT_NOTICE from '../shared/engagement-notice';
import * as GRAPHICS_NOTICE from '../shared/graphics-acceleration-notice';
import * as COMMUNITY_QR_DIALOG from '../shared/ui/community-qr-dialog';
import * as UPDATE_NOTICE from '../shared/update-notice';
import * as LumnoMessaging from '../platform/messaging';
import type { CommunityLinks } from '../domain/community-links';
import type { Disposition, OpenEvent } from '../domain/navigation-disposition';
import type { SiteSearchProvider } from '../domain/search/types';
import type { EngagementNoticeController } from '../shared/engagement-notice';
import type { GraphicsNoticeController } from '../shared/graphics-acceleration-notice';
import type { Translate } from './newtab-types';
import { renderPageNotice } from './react/page-notice';
import * as SearchSiteSearchProviders from '../domain/search/utils/site-search-providers';
import type { SiteSearchCatalog } from '../shared/search-panel/site-search/catalog';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';
import type { SearchModeActions } from '../shared/search-panel/mode-actions';
import * as FEATURE_HINTS from '../shared/ui/feature-hints';
import * as COMMUNITY_LINKS from '../platform/community-links';
import { getPagePortals } from './app/portals';
import type { SearchBoxParts } from './search/search-box-parts';
import type { PageNoticeControllers } from './notice-controllers';


interface PageNoticesDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  locale: Pick<SurfaceLocale, 'store'>;
  pageSearchParams: URLSearchParams;
  bottomDock: HTMLElement | null;
  t: Translate;
  getOpenDisposition(event: OpenEvent | Disposition | null | undefined, fallback?: Disposition): Disposition;
  getFeedbackWebLocale(): string;
  isFeedbackPopoverOpen(): boolean;
  openFeedbackExternalUrl(url: unknown, disposition?: Disposition): boolean;
  // Settles once the page's entry animation is done.
  newtabEntryAnimationReadyPromise: Promise<unknown>;
  // The search box's container.
  root: HTMLElement;
  siteSearchCatalog: Pick<SiteSearchCatalog, 'loadProviders'>;
  searchBox: Pick<SearchBoxParts, 'inputParts'>;
  notices: Pick<PageNoticeControllers, 'engagement' | 'graphics' | 'helpCenterAskHint' | 'mountHelpCenterAskHint' | 'mountUpdate' | 'update' | 'webdavHint'>;
  getFeedbackLinks(): CommunityLinks;
}

function createPageNotices(deps: PageNoticesDeps) {
  const {
    notices,
    searchBox,
    modeActions,
    locale,
    pageSearchParams,
    bottomDock,
    t,
    getOpenDisposition,
    getFeedbackWebLocale,
    isFeedbackPopoverOpen,
    openFeedbackExternalUrl,
    newtabEntryAnimationReadyPromise,
    root,
    siteSearchCatalog,
    getFeedbackLinks
  } = deps;


  // The search box exists before this module is created.
  const inputParts = searchBox.inputParts;
  if (!inputParts) {
    throw new Error('Search input unavailable');
  }
  const searchInput = inputParts.input;
  const searchInputContainer = inputParts.container;


  function clearPageNoticeQueryParam(): void {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('notice')) {
        return;
      }
      url.searchParams.delete('notice');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore URL rewrite failures.
    }
  }

  function openExtensionDetailsPage(detailsUrl: string): void {
    if (chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openExtensionDetailsPage' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          if (detailsUrl) {
            window.open(detailsUrl, '_blank');
          }
          return;
        }
        if (!response || response.ok !== true) {
          const fallbackUrl = response && response.url ? response.url : detailsUrl;
          if (fallbackUrl) {
            window.open(fallbackUrl, '_blank');
          }
        }
      });
      return;
    }
    if (detailsUrl) {
      window.open(detailsUrl, '_blank');
    }
  }

  function showFileAccessNotice(detailsUrl: string): void {
    renderPageNotice({
      params: pageSearchParams,
      chromeApi: chrome,
      document,
      windowObj: window,
      bottomDock,
      messages: {
        t,
        detailsUrl
      },
      onClose: () => {
        clearPageNoticeQueryParam();
      },
      openExtensionDetailsPage
    });
  }

  function maybeShowFileAccessNotice(): void {
    const notice = String(pageSearchParams.get('notice') || '').trim();
    if (notice !== 'file-access') {
      return;
    }
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      clearPageNoticeQueryParam();
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getFileSchemeAccessStatus' }, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        clearPageNoticeQueryParam();
        return;
      }
      if (!response || response.supported === false || response.allowed === true) {
        clearPageNoticeQueryParam();
        return;
      }
      showFileAccessNotice(response.detailsUrl || '');
    });
  }
  function updateNoticeClaimsSessionSlot(): boolean {
    return Boolean(
      notices.update &&
      typeof notices.update.hasSessionSlot === 'function' &&
      notices.update.hasSessionSlot()
    );
  }
  function graphicsNoticeClaimsSessionSlot(): boolean {
    return Boolean(notices.graphics && notices.graphics.hasSessionSlot());
  }
  notices.mountUpdate(UPDATE_NOTICE.createUpdateNotice({
    portals: getPagePortals(),
    documentObj: document,
    featureHints: FEATURE_HINTS,
    chromeApi: chrome,
    surface: 'newtab',
    t,
    onSessionSlotClaimed() {
      if (notices.engagement &&
          typeof notices.engagement.suppressForSession === 'function') {
        notices.engagement.suppressForSession();
      }
    },
    onDetailsClick(_notice, event) {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'openReleasePage',
        reason: 'notice',
        disposition: getOpenDisposition(event, 'newTab')
      });
    }
  }));
  // Shows only when the update notice leaves this page view's slot free.
  function createNewtabGraphicsNoticeController(): GraphicsNoticeController | null {
    return GRAPHICS_NOTICE.createGraphicsNotice({
      portals: getPagePortals(),
      documentObj: document,
      chromeApi: chrome,
      surface: 'newtab',
      t,
      exposureGate: notices.update && notices.update.ready,
      canShow() {
        return !updateNoticeClaimsSessionSlot() &&
          !String(searchInput.value || '').trim();
      },
      onSessionSlotClaimed() {
        if (notices.engagement) {
          notices.engagement.suppressForSession();
        }
      },
      onOpenSettings(event) {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'openGraphicsSettings',
          disposition: getOpenDisposition(event, 'newTab')
        });
      }
    });
  }
  function createNewtabEngagementNoticeController(): EngagementNoticeController | null {
    return ENGAGEMENT_NOTICE.createEngagementNotice({
      portals: getPagePortals(),
      documentObj: document,
      featureHints: FEATURE_HINTS,
      chromeApi: chrome,
      surface: 'newtab',
      locale: getFeedbackWebLocale(),
      t,
      exposureGate: Promise.all([
        notices.update && notices.update.ready,
        notices.graphics && notices.graphics.ready
      ]),
      canShow() {
        const updateNoticeVisible = Boolean(
          notices.update &&
          notices.update.element &&
          notices.update.element.getAttribute('data-visible') === 'true'
        );
        return !updateNoticeVisible &&
          !updateNoticeClaimsSessionSlot() &&
          !graphicsNoticeClaimsSessionSlot() &&
          document.visibilityState === 'visible' &&
          !String(searchInput.value || '').trim() &&
          document.body.getAttribute('data-nt-suggestions-open') !== 'true' &&
          !isFeedbackPopoverOpen();
      },
      onReview(event) {
        const links = getFeedbackLinks();
        openFeedbackExternalUrl(
          COMMUNITY_LINKS.getReviewUrl(links),
          getOpenDisposition(event, 'newTab')
        );
      },
      onCommunity(event) {
        const disposition = getOpenDisposition(event, 'newTab');
        const locale = getFeedbackWebLocale();
        const isWechat = ENGAGEMENT_NOTICE.getCommunityChannel(locale) === 'wechat';
        const communityUrlPromise = ENGAGEMENT_NOTICE.loadCommunityUrl({
          force: true,
          locale
        });
        void communityUrlPromise.then((url) => {
          if (isWechat) {
            openCommunityQrDialog(url);
            return;
          }
          openFeedbackExternalUrl(url, disposition);
        });
      }
    });
  }
  // Help Center results and the page the search row opens both follow the interface language.
  function getHelpCenterLocale(): string {
    return locale.store.getSnapshot().locale;
  }

  // The WeChat group QR opens in a dialog over the page, never in a new tab.
  function openCommunityQrDialog(qrUrl: string | null | undefined): void {
    if (!COMMUNITY_QR_DIALOG) {
      return;
    }
    COMMUNITY_QR_DIALOG.open({
      documentObj: document,
      imageUrl: qrUrl || getFeedbackLinks().wechatQr,
      title: t('newtab_feedback_wechat_panel_title', 'Bug 反馈 & 新功能提需'),
      alt: t('newtab_feedback_wechat_qr_alt', 'Lumno 微信群二维码'),
      closeLabel: t('newtab_feedback_wechat_close_tooltip', '关闭'),
      theme: document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
      glass: document.body.hasAttribute('data-glass-style'),
      returnFocus: document.activeElement
    });
  }
  // Above the search input, new installs and people updating to this version learn that the
  // Help Center answers questions here (lm + Tab). It stays until closed or until they ask one,
  // and only while the Help Center site search is enabled. Resolves to whether it is showing.
  let helpCenterAskProvider: SiteSearchProvider | null = null;
  const helpCenterAskHintSettled = ((): Promise<boolean> => {
    if (typeof FEATURE_HINTS.createFeatureHint !== 'function' ||
        document.documentElement.getAttribute('data-nt-focus-route-pending') === 'true') {
      return newtabEntryAnimationReadyPromise.then(() => false);
    }
    const askHint = FEATURE_HINTS.createFeatureHint({
      portals: getPagePortals(),
      documentObj: document,
      windowObj: window,
      chromeApi: chrome,
      definition: 'newtab-help-center-ask',
      visibilityGate: newtabEntryAnimationReadyPromise,
      initiallyVisible: false,
      t,
      onLinkClick() {
        dismissHelpCenterAskHint();
        if (helpCenterAskProvider) {
          modeActions.activateSiteSearch(helpCenterAskProvider);
        }
        searchInput.focus({ preventScroll: true });
      }
    });
    notices.mountHelpCenterAskHint(askHint);
    if (!askHint || !askHint.element) {
      return newtabEntryAnimationReadyPromise.then(() => false);
    }
    // Beside the search plate, anchored to the input, where CSS anchors work: inside it, the plate's
    // own backdrop filter would keep the hint's glass from reaching the wallpaper.
    const helpCenterAskHint = askHint.element;
    if (window.CSS && CSS.supports('anchor-name: --x-nt-search-input')) {
      helpCenterAskHint.setAttribute('data-search-anchored', 'true');
      root.after(helpCenterAskHint);
    } else {
      searchInputContainer.appendChild(helpCenterAskHint);
    }
    const providerReady = siteSearchCatalog.loadProviders()
      .then((items) => (items || [])
        .find((item) => SearchSiteSearchProviders.isHelpCenterSiteSearchProvider(item)) || null)
      .catch(() => null);
    return Promise.all([providerReady, askHint.ready]).then(([provider]) => {
      helpCenterAskProvider = provider;
      askHint.setVisible(Boolean(provider));
      return askHint.isVisible();
    });
  })();

  function dismissHelpCenterAskHint(): void {
    if (notices.helpCenterAskHint && !notices.helpCenterAskHint.isDismissed()) {
      notices.helpCenterAskHint.dismiss();
    }
  }

  function dismissWebdavFeatureHint(): void {
    if (notices.webdavHint && typeof notices.webdavHint.dismiss === 'function') {
      notices.webdavHint.dismiss();
    }
  }

  return {
    maybeShowFileAccessNotice,
    createNewtabGraphicsNoticeController,
    createNewtabEngagementNoticeController,
    getHelpCenterLocale,
    openCommunityQrDialog,
    helpCenterAskHintSettled,
    dismissHelpCenterAskHint,
    dismissWebdavFeatureHint
  };
}

type PageNotices = ReturnType<typeof createPageNotices>;

export { createPageNotices };
export type { PageNotices, PageNoticesDeps };
