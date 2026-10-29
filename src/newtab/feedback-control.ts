// The feedback button and popover: community links, QR code refresh and
// the React-rendered control.
import { createFeedbackControlHost, getFeedbackButtonElement } from './dom/feedback-control';
import type { CommunityLinks } from '../domain/community-links';
import type { Disposition } from '../domain/navigation-disposition';
import * as LumnoNewtabDismissStack from './dismiss-stack';
import type { Translate } from './newtab-types';
import type { FeedbackControlController, FeedbackControlModel } from './react/feedback';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';
import * as COMMUNITY_LINKS from '../platform/community-links';
import { createFeedbackControlController } from './react/feedback';
import type { FeedbackControlState } from './react/feedback';
import { createViewStore } from '../shared/react/view-store';
import * as COMMUNITY_QR_DIALOG from '../shared/ui/community-qr-dialog';


interface FeedbackControlDeps {
  locale: Pick<SurfaceLocale, 'store'>;
  t: Translate;
  openExternalNewTabUrl(url: string, disposition: Disposition): boolean;
  hideTopActionTooltip(): void;
  showTopActionTooltip(anchor: HTMLElement, text: string, options?: { checkActive?: boolean; placement?: string }): void;
}

function createFeedbackControlRuntime(deps: FeedbackControlDeps) {
  const {
    locale,
    t,
    openExternalNewTabUrl,
    hideTopActionTooltip,
    showTopActionTooltip
  } = deps;

  // The community links the popover shows; the fallback until they load.
  let feedbackLinks: CommunityLinks = COMMUNITY_LINKS.FALLBACK_LINKS;
  // The control's host, its button and the React controller drawing it, once made.
  let feedbackControl: HTMLDivElement | null = null;
  let feedbackButton: HTMLElement | null = null;
  let feedbackReactController: FeedbackControlController | null = null;
  // The control's model, which it draws from.
  const feedbackModel = createViewStore<FeedbackControlState>({ model: null });

  const LUMNO_FEEDBACK_QR_REFRESH_TIMEOUT_MS = 5000;
  let feedbackRefreshResultTooltipTimer = 0;
  let feedbackLinksLoaded = false;

  function normalizeFeedbackHttpsUrl(value: unknown): string {
    return COMMUNITY_LINKS.normalizeHttpsUrl(value);
  }

  function loadFeedbackLinks(options?: { force?: boolean }): Promise<CommunityLinks | null> {
    const force = Boolean(options && options.force);
    if (!force && feedbackLinksLoaded) {
      return Promise.resolve(feedbackLinks);
    }
    return COMMUNITY_LINKS.load({ force })
      .then((links) => {
        feedbackLinks = links || COMMUNITY_LINKS.FALLBACK_LINKS;
        feedbackLinksLoaded = true;
        return feedbackLinks;
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
    const links = feedbackLinks || COMMUNITY_LINKS.FALLBACK_LINKS;
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
      githubIssueUrl: links.githubIssue || COMMUNITY_LINKS.FALLBACK_LINKS.githubIssue,
      menuAriaLabel: t('newtab_feedback_menu_aria', 'Feedback channels'),
      panelTitle: channel === 'wechat'
        ? t('newtab_feedback_wechat_panel_title', 'Bug reports & feature requests')
        : t('newtab_feedback_x_label', 'X'),
      qrAlt: t('newtab_feedback_wechat_qr_alt', 'Lumno WeChat group QR code'),
      qrUrl: links.wechatQr || COMMUNITY_LINKS.FALLBACK_LINKS.wechatQr,
      refreshTooltip: t('newtab_feedback_wechat_refresh_tooltip', 'Refresh QR code'),
      xLabel: t('newtab_feedback_x_label', 'X'),
      xTooltip: t('newtab_feedback_x_tooltip', 'Contact us on X'),
      xUrl: links.x || COMMUNITY_LINKS.FALLBACK_LINKS.x
    };
  }

  function syncFeedbackReactElementReferences(): void {
    if (!feedbackControl) {
      return;
    }
    feedbackButton = getFeedbackButtonElement(feedbackControl);
  }

  function renderFeedbackControlWithReact(): boolean {
    if (!feedbackReactController) {
      return false;
    }
    feedbackModel.setState({ model: buildFeedbackReactModel() });
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
    return Boolean(feedbackReactController && feedbackReactController.isOpen());
  }

  function closeFeedbackPopover(options?: { restoreFocus?: boolean }): void {
    setFeedbackPopoverOpen(false, options);
  }

  function setFeedbackPopoverOpen(open: boolean, options?: { restoreFocus?: boolean }): void {
    if (!open) {
      clearFeedbackRefreshResultTooltipTimer();
      hideTopActionTooltip();
    }
    const controller = feedbackReactController;
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
    isOpen: () => Boolean(feedbackReactController && isFeedbackPopoverOpen()),
    close: () => closeFeedbackPopover({ restoreFocus: true })
  });

  function createFeedbackControls(): HTMLDivElement {
    const control = createFeedbackControlHost(document);
    feedbackControl = control;
    feedbackReactController =
      createFeedbackControlController(
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
              feedbackLinks = links || feedbackLinks;
              const currentLinks = feedbackLinks;
              const channel = getFeedbackCommunityChannel(currentLinks);
              if (channel !== 'wechat') {
                renderFeedbackControlWithReact();
                return {};
              }
              const refreshedUrl = buildFreshFeedbackQrUrl(
                (currentLinks && currentLinks.wechatQr) ||
                  COMMUNITY_LINKS.FALLBACK_LINKS.wechatQr
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
        },
        feedbackModel
      );
    renderFeedbackControlWithReact();
    return control;
  }

  function getFeedbackLinks(): CommunityLinks {
    return feedbackLinks;
  }

  function getFeedbackControl(): HTMLDivElement | null {
    return feedbackControl;
  }

  function getFeedbackButton(): HTMLElement | null {
    return feedbackButton;
  }


  // The WeChat group QR opens in a dialog over the page, never in a new tab.
  function openCommunityQrDialog(qrUrl: string | null | undefined): void {
    if (!COMMUNITY_QR_DIALOG) {
      return;
    }
    COMMUNITY_QR_DIALOG.open({
      documentObj: document,
      imageUrl: qrUrl || feedbackLinks.wechatQr,
      title: t('newtab_feedback_wechat_panel_title', 'Bug 反馈 & 新功能提需'),
      alt: t('newtab_feedback_wechat_qr_alt', 'Lumno 微信群二维码'),
      closeLabel: t('newtab_feedback_wechat_close_tooltip', '关闭'),
      theme: document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
      glass: document.body.hasAttribute('data-glass-style'),
      returnFocus: document.activeElement
    });
  }
  return {
    openCommunityQrDialog,
    getFeedbackLinks,
    getFeedbackControl,
    getFeedbackButton,
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
export type { FeedbackControlDeps, FeedbackControlRuntime };
