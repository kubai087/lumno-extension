// Notices in the overlay: the update notice and its session slot, the
// graphics acceleration notice, the engagement notice and the community QR
// dialog.
import type { Disposition } from '../../domain/navigation-disposition';
import * as ENGAGEMENT_NOTICE from '../../shared/engagement-notice';
import type { EngagementNoticeController } from '../../shared/engagement-notice';
import * as GRAPHICS_NOTICE from '../../shared/graphics-acceleration-notice';
import type { GraphicsNoticeController } from '../../shared/graphics-acceleration-notice';
import * as COMMUNITY_QR_DIALOG from '../../shared/ui/community-qr-dialog';
import * as FEATURE_HINTS from '../../shared/ui/feature-hints';
import * as UPDATE_NOTICE from '../../shared/update-notice';
import type { UpdateNoticeController } from '../../shared/update-notice';
import * as LumnoMessaging from '../../platform/messaging';
import type { ActivationEvent } from './result-activation';
import type { Translate } from './types';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import * as COMMUNITY_LINKS from '../../platform/community-links';

interface PanelNoticesState {
  overlay: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  overlayUpdateNoticeController: UpdateNoticeController | null;
  overlayGraphicsNoticeController: GraphicsNoticeController | null;
  overlayEngagementNoticeController: EngagementNoticeController | null;
}

interface PanelNoticesDeps {
  removeOverlay(overlay: HTMLElement | null): void;
  t: Translate;
  getOpenDisposition(event: ActivationEvent | null, fallback?: Disposition): Disposition;
  locale: Pick<SurfaceLocale, 'store'>;
  overlayState: PanelNoticesState;
}

function createPanelNotices(deps: PanelNoticesDeps) {
  const {
    removeOverlay,
    t,
    getOpenDisposition,
    locale
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  // The WeChat group QR opens in a dialog over the page, never in a new tab.
  // The overlay closes first, as it does for any result it opens.
  function openOverlayCommunityQrDialog(qrUrl: string): void {
    const theme = overlayState.overlay && overlayState.overlay.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    removeOverlay(overlayState.overlay);
    COMMUNITY_QR_DIALOG.open({
      documentObj: document,
      imageUrl: qrUrl || COMMUNITY_LINKS.FALLBACK_LINKS.wechatQr,
      title: t('newtab_feedback_wechat_panel_title', 'Bug 反馈 & 新功能提需'),
      alt: t('newtab_feedback_wechat_qr_alt', 'Lumno 微信群二维码'),
      closeLabel: t('newtab_feedback_wechat_close_tooltip', '关闭'),
      theme
    });
  }
  function overlayUpdateNoticeClaimsSessionSlot(): boolean {
    return Boolean(
      overlayState.overlayUpdateNoticeController &&
      typeof overlayState.overlayUpdateNoticeController.hasSessionSlot === 'function' &&
      overlayState.overlayUpdateNoticeController.hasSessionSlot()
    );
  }
  overlayState.overlayUpdateNoticeController = UPDATE_NOTICE.createUpdateNotice({
    documentObj: document,
    featureHints: FEATURE_HINTS,
    chromeApi: chrome,
    surface: 'overlay',
    t,
    onSessionSlotClaimed() {
      if (overlayState.overlayEngagementNoticeController &&
          typeof overlayState.overlayEngagementNoticeController.suppressForSession === 'function') {
        overlayState.overlayEngagementNoticeController.suppressForSession();
      }
    },
    onDetailsClick(_notice, event) {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'openReleasePage',
        reason: 'notice',
        disposition: getOpenDisposition(event, 'newTab')
      });
    }
  });
  function overlayGraphicsNoticeClaimsSessionSlot(): boolean {
    return Boolean(
      overlayState.overlayGraphicsNoticeController &&
      overlayState.overlayGraphicsNoticeController.hasSessionSlot()
    );
  }
  // Shows only when the update notice leaves this session's slot free.
  overlayState.overlayGraphicsNoticeController = GRAPHICS_NOTICE.createGraphicsNotice({
    documentObj: document,
    chromeApi: chrome,
    surface: 'overlay',
    t,
    exposureGate: overlayState.overlayUpdateNoticeController && overlayState.overlayUpdateNoticeController.ready,
    canShow() {
      const input = overlayState.searchInput;
      return !overlayUpdateNoticeClaimsSessionSlot() &&
        !String(input ? input.value || '' : '').trim();
    },
    onSessionSlotClaimed() {
      if (overlayState.overlayEngagementNoticeController) {
        overlayState.overlayEngagementNoticeController.suppressForSession();
      }
    },
    onOpenSettings(event) {
      removeOverlay(overlayState.overlay);
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'openGraphicsSettings',
        disposition: getOpenDisposition(event, 'newTab')
      });
    }
  });
  overlayState.overlayEngagementNoticeController =
    ENGAGEMENT_NOTICE.createEngagementNotice({
      documentObj: document,
      featureHints: FEATURE_HINTS,
      chromeApi: chrome,
      surface: 'overlay',
      locale: locale.store.getSnapshot().locale,
      t,
      exposureGate: Promise.all([
        overlayState.overlayUpdateNoticeController && overlayState.overlayUpdateNoticeController.ready,
        overlayState.overlayGraphicsNoticeController && overlayState.overlayGraphicsNoticeController.ready
      ]),
      // Waits until no update or graphics notice shows, the page is in view
      // and the input is empty.
      canShow() {
        const updateNotice = overlayState.overlayUpdateNoticeController;
        const updateNoticeVisible = Boolean(
          updateNotice &&
          updateNotice.element &&
          updateNotice.element.getAttribute('data-visible') === 'true'
        );
        const overlay = overlayState.overlay;
        const input = overlayState.searchInput;
        return !updateNoticeVisible &&
          !overlayUpdateNoticeClaimsSessionSlot() &&
          !overlayGraphicsNoticeClaimsSessionSlot() &&
          document.visibilityState === 'visible' &&
          Boolean(overlay && overlay.isConnected) &&
          !String(input ? input.value || '' : '').trim();
      },
      onReview(event) {
        const disposition = getOpenDisposition(event, 'newTab');
        void ENGAGEMENT_NOTICE.loadReviewUrl().then((url) => {
          if (!url) {
            return;
          }
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
            action: 'createTab',
            url,
            disposition
          });
        });
      },
      onCommunity(event) {
        const disposition = getOpenDisposition(event, 'newTab');
        const shownLocale = locale.store.getSnapshot().locale;
        const isWechat = ENGAGEMENT_NOTICE.getCommunityChannel(shownLocale) === 'wechat';
        const communityUrlPromise =
          ENGAGEMENT_NOTICE.loadCommunityUrl({
            force: true,
            locale: shownLocale
          });
        void communityUrlPromise.then((url) => {
          if (isWechat) {
            openOverlayCommunityQrDialog(url);
            return;
          }
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
            action: 'createTab',
            url,
            disposition
          });
        });
      }
    });

  return {
    openOverlayCommunityQrDialog
  };
}

export { createPanelNotices };
export type { PanelNoticesDeps, PanelNoticesState };
