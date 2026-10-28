// The feedback button and popover: community links, QR code refresh and
// the React-rendered control.
import type { CommunityLinks } from '../domain/community-links';
import type * as LumnoCommunityLinks from '../platform/community-links';
import type { Disposition } from '../domain/navigation-disposition';
import { queryHtmlElement } from '../shared/dom-lookup';
import * as LumnoNewtabDismissStack from './dismiss-stack';
import type { Translate } from './newtab-types';
import type { createFeedbackControlApi, FeedbackControlController, FeedbackControlModel } from './react/feedback';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';

interface FeedbackControlState {
  feedbackLinks: CommunityLinks | null;
  feedbackControl: HTMLDivElement | null;
  feedbackButton: HTMLElement | null;
  feedbackReactController: FeedbackControlController | null;
}

interface FeedbackControlDeps {
  locale: Pick<SurfaceLocale, 'store'>;
  COMMUNITY_LINKS: Pick<typeof LumnoCommunityLinks,
    'normalizeHttpsUrl' | 'load' | 'getCommunityChannel' | 'buildFreshQrUrl' | 'getReviewUrl'>;
  LUMNO_FEEDBACK_LINKS_FALLBACK: CommunityLinks;
  t: Translate;
  openExternalNewTabUrl(url: string, disposition: Disposition): boolean;
  hideTopActionTooltip(): void;
  NEWTAB_FEEDBACK_CONTROL: ReturnType<typeof createFeedbackControlApi>;
  showTopActionTooltip(anchor: HTMLElement, text: string, options?: { checkActive?: boolean; placement?: string }): void;
  pageState: FeedbackControlState;
}

function createFeedbackControlRuntime(deps: FeedbackControlDeps) {
  const {
    locale,
    COMMUNITY_LINKS,
    LUMNO_FEEDBACK_LINKS_FALLBACK,
    t,
    openExternalNewTabUrl,
    hideTopActionTooltip,
    NEWTAB_FEEDBACK_CONTROL,
    showTopActionTooltip
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const LUMNO_FEEDBACK_QR_REFRESH_TIMEOUT_MS = 5000;
  let feedbackRefreshResultTooltipTimer = 0;
  let feedbackLinksLoaded = false;

  function normalizeFeedbackHttpsUrl(value: unknown): string {
    return COMMUNITY_LINKS.normalizeHttpsUrl(value);
  }

  function loadFeedbackLinks(options?: { force?: boolean }): Promise<CommunityLinks | null> {
    const force = Boolean(options && options.force);
    if (!force && feedbackLinksLoaded) {
      return Promise.resolve(pageState.feedbackLinks);
    }
    return COMMUNITY_LINKS.load({ force })
      .then((links) => {
        pageState.feedbackLinks = links || LUMNO_FEEDBACK_LINKS_FALLBACK;
        feedbackLinksLoaded = true;
        return pageState.feedbackLinks;
      });
  }

  function getFeedbackWebLocale(): string {
    const shownLocale = locale.store.getSnapshot().locale;
    if (shownLocale === 'zh_CN') {
      return 'zh-CN';
    }
    if (shownLocale === 'zh_TW') {
      return 'zh-TW';
    }
    if (shownLocale === 'ja') {
      return 'ja';
    }
    return 'en';
  }

  function getFeedbackCommunityChannel(links: Partial<CommunityLinks> | null): FeedbackControlModel['channel'] {
    return COMMUNITY_LINKS.getCommunityChannel(links, getFeedbackWebLocale());
  }

  function clearFeedbackRefreshResultTooltipTimer(): void {
    if (!feedbackRefreshResultTooltipTimer) {
      return;
    }
    window.clearTimeout(feedbackRefreshResultTooltipTimer);
    feedbackRefreshResultTooltipTimer = 0;
  }

  function buildFreshFeedbackQrUrl(value: unknown): string {
    return COMMUNITY_LINKS.buildFreshQrUrl(value);
  }

  function preloadFeedbackQrImage(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      const preloader = new Image();
      let settled = false;
      const finish = (loaded: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        preloader.onload = null;
        preloader.onerror = null;
        resolve(loaded);
      };
      const timeoutId = window.setTimeout(() => {
        finish(false);
      }, LUMNO_FEEDBACK_QR_REFRESH_TIMEOUT_MS);
      preloader.onload = () => {
        finish(true);
      };
      preloader.onerror = () => {
        finish(false);
      };
      preloader.src = url;
    });
  }

  function buildFeedbackReactModel(): FeedbackControlModel {
    const links = pageState.feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK;
    const channel = getFeedbackCommunityChannel(links);
    return {
      buttonLabel: t('newtab_feedback_button_aria', 'Send feedback'),
      channel,
      chromeReviewLabel: t('newtab_feedback_chrome_review_label', 'Store rating'),
      chromeReviewTooltip: t(
        'newtab_feedback_chrome_review_tooltip',
        'Rate Lumno in the extension store'
      ),
      chromeReviewUrl: COMMUNITY_LINKS.getReviewUrl(links),
      closeTooltip: t('newtab_feedback_wechat_close_tooltip', 'Close'),
      communityLabel: channel === 'wechat'
        ? t('newtab_feedback_wechat_label', 'WeChat')
        : t('newtab_feedback_x_label', 'X'),
      communityTooltip: channel === 'wechat'
        ? t('newtab_feedback_wechat_tooltip', 'Join the WeChat group')
        : t('newtab_feedback_x_tooltip', 'Contact us on X'),
      githubIssueLabel: t('newtab_feedback_github_issue_label', 'GitHub Issue'),
      githubIssueTooltip: t(
        'newtab_feedback_github_issue_tooltip',
        'Open a GitHub issue'
      ),
      githubIssueUrl: links.githubIssue || LUMNO_FEEDBACK_LINKS_FALLBACK.githubIssue,
      menuAriaLabel: t('newtab_feedback_menu_aria', 'Feedback channels'),
      panelTitle: channel === 'wechat'
        ? t('newtab_feedback_wechat_panel_title', 'Bug reports & feature requests')
        : t('newtab_feedback_x_label', 'X'),
      qrAlt: t('newtab_feedback_wechat_qr_alt', 'Lumno WeChat group QR code'),
      qrUrl: links.wechatQr || LUMNO_FEEDBACK_LINKS_FALLBACK.wechatQr,
      refreshTooltip: t('newtab_feedback_wechat_refresh_tooltip', 'Refresh QR code'),
      xLabel: t('newtab_feedback_x_label', 'X'),
      xTooltip: t('newtab_feedback_x_tooltip', 'Contact us on X'),
      xUrl: links.x || LUMNO_FEEDBACK_LINKS_FALLBACK.x
    };
  }

  function syncFeedbackReactElementReferences(): void {
    if (!pageState.feedbackControl) {
      return;
    }
    pageState.feedbackButton = queryHtmlElement(pageState.feedbackControl, '.x-nt-feedback-button');
  }

  function renderFeedbackControlWithReact(): boolean {
    if (!pageState.feedbackReactController ||
        typeof pageState.feedbackReactController.render !== 'function') {
      return false;
    }
    pageState.feedbackReactController.render(buildFeedbackReactModel());
    syncFeedbackReactElementReferences();
    return true;
  }

  function openFeedbackExternalUrl(url: unknown, disposition?: Disposition): boolean {
    const safeUrl = normalizeFeedbackHttpsUrl(url);
    if (!safeUrl) {
      return false;
    }
    return openExternalNewTabUrl(safeUrl, disposition || 'newTab');
  }

  function updateFeedbackLanguageStrings(): void {
    renderFeedbackControlWithReact();
  }

  function isFeedbackPopoverOpen(): boolean {
    return Boolean(pageState.feedbackReactController && pageState.feedbackReactController.isOpen());
  }

  function closeFeedbackPopover(options?: { restoreFocus?: boolean }): void {
    setFeedbackPopoverOpen(false, options);
  }

  function setFeedbackPopoverOpen(open: boolean, options?: { restoreFocus?: boolean }): void {
    if (!open) {
      clearFeedbackRefreshResultTooltipTimer();
      hideTopActionTooltip();
    }
    const controller = pageState.feedbackReactController;
    if (!controller) {
      return;
    }
    if (open) {
      controller.setOpen(true);
    } else {
      controller.close(options);
    }
  }

  LumnoNewtabDismissStack.getDismissStack().register('feedback-popover', {
    isOpen: () => Boolean(pageState.feedbackReactController && isFeedbackPopoverOpen()),
    close: () => closeFeedbackPopover({ restoreFocus: true })
  });

  function createFeedbackControls(): void {
    const control = document.createElement('div');
    pageState.feedbackControl = control;
    pageState.feedbackReactController =
      NEWTAB_FEEDBACK_CONTROL.createFeedbackControlController(
        control,
        {
          onHideTooltip() {
            clearFeedbackRefreshResultTooltipTimer();
            hideTopActionTooltip();
          },
          onOpen() {
            return loadFeedbackLinks({ force: true }).then(() => {
              renderFeedbackControlWithReact();
            });
          },
          onOpenExternal(url, disposition) {
            openFeedbackExternalUrl(url, disposition);
          },
          async onRefreshQr() {
            try {
              const links = await loadFeedbackLinks({ force: true });
              pageState.feedbackLinks = links || pageState.feedbackLinks;
              const currentLinks = pageState.feedbackLinks;
              const channel = getFeedbackCommunityChannel(currentLinks);
              if (channel !== 'wechat') {
                renderFeedbackControlWithReact();
                return {};
              }
              const refreshedUrl = buildFreshFeedbackQrUrl(
                (currentLinks && currentLinks.wechatQr) ||
                  LUMNO_FEEDBACK_LINKS_FALLBACK.wechatQr
              );
              const loaded = await preloadFeedbackQrImage(refreshedUrl);
              return loaded
                ? {
                    message: t(
                      'newtab_feedback_wechat_refresh_success',
                      'Latest QR code loaded'
                    ),
                    qrUrl: refreshedUrl
                  }
                : {
                    message: t(
                      'newtab_feedback_wechat_refresh_error',
                      'Could not refresh. Try again.'
                    )
                  };
            } catch {
              return {
                message: t(
                  'newtab_feedback_wechat_refresh_error',
                  'Could not refresh. Try again.'
                )
              };
            }
          },
          onShowTooltip(target, label) {
            showTopActionTooltip(target, label, {
              checkActive: false,
              placement: 'top'
            });
          }
        }
      );
    renderFeedbackControlWithReact();
  }

  return {
    getFeedbackWebLocale,
    openFeedbackExternalUrl,
    updateFeedbackLanguageStrings,
    isFeedbackPopoverOpen,
    closeFeedbackPopover,
    createFeedbackControls
  };
}

type FeedbackControlRuntime = ReturnType<typeof createFeedbackControlRuntime>;

export { createFeedbackControlRuntime };
export type { FeedbackControlDeps, FeedbackControlRuntime, FeedbackControlState };
