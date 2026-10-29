// Notices in the overlay: the update notice and its session slot, the
// graphics acceleration notice, the engagement notice and the community QR
// dialog.
import type { Disposition } from '../../domain/navigation-disposition';
import * as ENGAGEMENT_NOTICE from '../../shared/engagement-notice';
import * as GRAPHICS_NOTICE from '../../shared/graphics-acceleration-notice';
import * as UPDATE_NOTICE from '../../shared/update-notice';
import * as LumnoMessaging from '../../platform/messaging';
import type { ActivationEvent } from './result-activation';
import type { Translate } from './types';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { PortalHost } from '../../shared/react/portal-host';
import type { OverlayPanelElements } from './panel-elements';
import type { OverlayNotices } from './overlay-notices';

interface PanelNoticesDeps {
  // Opens the community QR code in a dialog over the page.
  openOverlayCommunityQrDialog(qrUrl: string): void;
  // The panel's React root, which draws the notices.
  portals: PortalHost;
  removeOverlay(overlay: HTMLElement | null): void;
  t: Translate;
  getOpenDisposition(event: ActivationEvent | null, fallback?: Disposition): Disposition;
  locale: Pick<SurfaceLocale, 'store'>;
  elements: Pick<OverlayPanelElements, 'overlay' | 'searchInput'>;
  notices: Pick<OverlayNotices, 'engagement' | 'graphics' | 'setEngagement' | 'setGraphics' | 'setUpdate' | 'update'>;
}

function createPanelNotices(deps: PanelNoticesDeps): void {
  const {
    openOverlayCommunityQrDialog,
    notices,
    elements,
    portals,
    removeOverlay,
    t,
    getOpenDisposition,
    locale
  } = deps;

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

}

export { createPanelNotices };
export type { PanelNoticesDeps };
