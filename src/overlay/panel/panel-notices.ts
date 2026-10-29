// Notices in the overlay: the update notice and its session slot, the
// graphics acceleration notice, the engagement notice and the community QR
// dialog.
import type { Disposition } from '../../domain/navigation-disposition';
import * as ENGAGEMENT_NOTICE from '../../shared/engagement-notice';
import * as GRAPHICS_NOTICE from '../../shared/graphics-acceleration-notice';
import * as COMMUNITY_QR_DIALOG from '../../shared/ui/community-qr-dialog';
import * as FEATURE_HINTS from '../../shared/ui/feature-hints';
import * as UPDATE_NOTICE from '../../shared/update-notice';
import * as LumnoMessaging from '../../platform/messaging';
import type { ActivationEvent } from './result-activation';
import type { Translate } from './types';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import * as COMMUNITY_LINKS from '../../platform/community-links';
import type { PortalHost } from '../../shared/react/portal-host';
import type { OverlayPanelElements } from './panel-elements';
import type { OverlayNotices } from './overlay-notices';

interface PanelNoticesDeps {
  // The panel's React root, which draws the notices.
  portals: PortalHost;
  removeOverlay(overlay: HTMLElement | null): void;
  t: Translate;
  getOpenDisposition(event: ActivationEvent | null, fallback?: Disposition): Disposition;
  locale: Pick<SurfaceLocale, 'store'>;
  elements: Pick<OverlayPanelElements, 'overlay' | 'searchInput'>;
  notices: Pick<OverlayNotices, 'engagement' | 'graphics' | 'setEngagement' | 'setGraphics' | 'setUpdate' | 'update'>;
}

function createPanelNotices(deps: PanelNoticesDeps) {
  const {
    notices,
    elements,
    portals,
    removeOverlay,
    t,
    getOpenDisposition,
    locale
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
  function overlayUpdateNoticeClaimsSessionSlot(): boolean {
    return Boolean(
      notices.update &&
      typeof notices.update.hasSessionSlot === 'function' &&
      notices.update.hasSessionSlot()
    );
  }
  notices.setUpdate(UPDATE_NOTICE.createUpdateNotice({
    portals,
    documentObj: document,
    featureHints: FEATURE_HINTS,
    chromeApi: chrome,
    surface: 'overlay',
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
  function overlayGraphicsNoticeClaimsSessionSlot(): boolean {
    return Boolean(
      notices.graphics &&
      notices.graphics.hasSessionSlot()
    );
  }
  // Shows only when the update notice leaves this session's slot free.
  notices.setGraphics(GRAPHICS_NOTICE.createGraphicsNotice({
    portals,
    documentObj: document,
    chromeApi: chrome,
    surface: 'overlay',
    t,
    exposureGate: notices.update && notices.update.ready,
    canShow() {
      const input = elements.searchInput;
      return !overlayUpdateNoticeClaimsSessionSlot() &&
        !String(input ? input.value || '' : '').trim();
    },
    onSessionSlotClaimed() {
      if (notices.engagement) {
        notices.engagement.suppressForSession();
      }
    },
    onOpenSettings(event) {
      removeOverlay(elements.overlay);
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'openGraphicsSettings',
        disposition: getOpenDisposition(event, 'newTab')
      });
    }
  }));
  notices.setEngagement(ENGAGEMENT_NOTICE.createEngagementNotice({
      portals,
      documentObj: document,
      featureHints: FEATURE_HINTS,
      chromeApi: chrome,
      surface: 'overlay',
      locale: locale.store.getSnapshot().locale,
      t,
      exposureGate: Promise.all([
        notices.update && notices.update.ready,
        notices.graphics && notices.graphics.ready
      ]),
      // Waits until no update or graphics notice shows, the page is in view
      // and the input is empty.
      canShow() {
        const updateNotice = notices.update;
        const updateNoticeVisible = Boolean(
          updateNotice &&
          updateNotice.element &&
          updateNotice.element.getAttribute('data-visible') === 'true'
        );
        const overlay = elements.overlay;
        const input = elements.searchInput;
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
    }));

  return {
    openOverlayCommunityQrDialog
  };
}

export { createPanelNotices };
export type { PanelNoticesDeps };
