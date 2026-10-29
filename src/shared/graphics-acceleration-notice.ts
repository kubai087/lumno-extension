// The capsule under New Tab's search box and above the overlay that suggests
// turning on graphics acceleration, when the worker's probe found the browser
// drawing without the GPU and a fresh probe agrees. New installs and people
// updating keep seeing it until they close it; opening the setting only hides
// it for this page view. The worker's answer is the graphicsProbe setting.
import * as LumnoFeatureHints from './ui/feature-hints';
import * as LumnoMessaging from '../platform/messaging';
import { featureHintDismissedOnDevice, graphicsProbe, normalizeGraphicsRendering } from '../domain/settings/features';
import type { GraphicsRendering } from '../domain/settings/features';
import { getContextSettingsStore } from '../platform/settings-store';
import type { SettingsStore } from '../platform/settings-store';
import type { FeatureHintChromeApi, FeatureHintController, FeatureHintDefinition } from './ui/feature-hint-catalog';
import { getFeatureHintLocalDismissKey } from './ui/feature-hint-dismiss';
import type { PortalHost } from './react/portal-host';

type GraphicsNoticeSurface = 'newtab' | 'overlay';

type Translate = (key: string, fallback: string) => string;

interface GraphicsNoticeOptions {
  // The surface's React root, which draws the notice.
  portals: PortalHost;
  documentObj?: Document | null;
  chromeApi?: FeatureHintChromeApi | null;
  // The context's settings store by default.
  settingsStore?: SettingsStore | null;
  featureHints?: Pick<typeof LumnoFeatureHints, 'createFeatureHint'> | null;
  surface?: string;
  t?: Translate;
  // The notice waits for this (the update notice deciding whether to show).
  exposureGate?: unknown;
  // Return false while the page has something else to show.
  canShow?(): boolean;
  onOpenSettings?(event: MouseEvent): void;
  // Probes again before showing; the worker's by default.
  checkRendering?(): Promise<GraphicsRendering>;
  // The notice showed, so other notices this page view should wait.
  onSessionSlotClaimed?(): void;
}

interface GraphicsNoticeController extends Omit<FeatureHintController, 'ready'> {
  hasSessionSlot(): boolean;
  // Resolves to whether the notice claimed this page view's notice slot.
  ready: Promise<boolean>;
}

const GRAPHICS_NOTICE_ID = 'graphics-acceleration-notice';
const GRAPHICS_NOTICE_VERSION = '1';

function readSurface(surface: unknown): GraphicsNoticeSurface {
  return surface === 'overlay' ? 'overlay' : 'newtab';
}

function createGraphicsNoticeDefinition(surface: unknown): Readonly<FeatureHintDefinition> {
  const surfaceName = readSurface(surface);
  return Object.freeze({
    id: GRAPHICS_NOTICE_ID,
    introducedIn: GRAPHICS_NOTICE_VERSION,
    surface: surfaceName,
    placement: surfaceName === 'overlay' ? 'above search input' : 'below search input',
    className: [
      'x-lumno-feature-hint--update-notice',
      `x-lumno-feature-hint--update-notice-${surfaceName}`,
      'x-lumno-feature-hint--graphics-notice'
    ].join(' '),
    arrowSide: surfaceName === 'overlay' ? 'bottom' : 'top',
    arrowAlign: 'center',
    widthMode: 'container',
    alignMode: 'auto',
    // The GPU belongs to this computer, so closing it here keeps it on others.
    dismissStorage: 'local',
    rememberOnFirstShow: false,
    badgeIconText: '⚡',
    badgeKey: 'graphics_notice_badge',
    badgeFallback: 'Graphics acceleration is off',
    textKey: 'graphics_notice_text',
    textFallback: 'Turn it on for smoother pages; it takes a browser restart',
    linkKey: 'graphics_notice_link',
    linkFallback: 'Turn on',
    closeLabelKey: 'graphics_notice_close',
    closeLabelFallback: 'Dismiss graphics acceleration tip'
  });
}

// Asks the worker to probe now, so a stale answer (from a browser start
// before the GPU was ready, say) never shows the notice.
function askWorkerForRendering(): Promise<GraphicsRendering> {
  const runtime = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : null;
  if (!runtime) {
    return Promise.resolve('unknown');
  }
  return new Promise((resolve) => {
    try {
      LumnoMessaging.sendBackgroundMessage(runtime, { action: 'checkGraphicsRendering' }, (reply) => {
        resolve(runtime.lastError || !reply ? 'unknown' : normalizeGraphicsRendering(reply.rendering));
      });
    } catch (_error) {
      resolve('unknown');
    }
  });
}

// Whether the stored answer, and then a fresh probe, both say the browser
// draws without the GPU.
function confirmSoftwareRendering(store: SettingsStore, checkRendering: () => Promise<GraphicsRendering>): Promise<boolean> {
  return store.include(graphicsProbe).then(() => {
    if (store.get(graphicsProbe).rendering !== 'software') {
      return false;
    }
    return checkRendering().then((rendering) => rendering === 'software', () => false);
  });
}

function createGraphicsNotice(options: GraphicsNoticeOptions): GraphicsNoticeController | null {
  const config = options;
  const documentObj = config.documentObj || (typeof document !== 'undefined' ? document : null);
  const featureHints = config.featureHints || LumnoFeatureHints;
  const chromeApi = config.chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
  const store = config.settingsStore || (chromeApi && chromeApi.storage ? getContextSettingsStore(chromeApi) : null);
  if (!documentObj || !store) {
    return null;
  }
  const definition = createGraphicsNoticeDefinition(config.surface);
  const dismissKey = getFeatureHintLocalDismissKey(definition);
  const dismissId = featureHintDismissedOnDevice.idOf(dismissKey);
  const dismissSetting = dismissId ? featureHintDismissedOnDevice.member(dismissId) : null;
  let destroyed = false;
  let sessionSlotClaimed = false;
  let hint: FeatureHintController | null = null;

  hint = featureHints.createFeatureHint({
    portals: config.portals,
    documentObj,
    definition,
    chromeApi,
    dismissKey,
    t: config.t,
    initiallyVisible: false,
    // Still drawing without the GPU after a restart, it comes back.
    onLinkClick(event) {
      hint?.setVisible(false);
      config.onOpenSettings?.(event);
    }
  });
  if (!hint) {
    return null;
  }
  const shown: FeatureHintController = hint;
  const canShowNow = (): boolean => !destroyed && (typeof config.canShow !== 'function' || config.canShow() !== false);

  const readyPromise: Promise<boolean> = Promise.all([
    shown.ready,
    Promise.resolve(config.exposureGate).catch(() => null)
  ]).then(() => (shown.isDismissed()
    ? false
    : confirmSoftwareRendering(store, config.checkRendering || askWorkerForRendering)
  )).then((software) => {
    if (!software || shown.isDismissed() || !canShowNow()) {
      return false;
    }
    shown.setVisible(true);
    if (!shown.isVisible()) {
      return false;
    }
    sessionSlotClaimed = true;
    config.onSessionSlotClaimed?.();
    return true;
  });

  // Closed or acted on in another tab, or the GPU is back after a restart.
  const followed = dismissSetting ? [graphicsProbe, dismissSetting] : [graphicsProbe];
  const unsubscribe = store.subscribe(followed, () => {
    if (!destroyed && (store.get(graphicsProbe).rendering !== 'software' || (dismissSetting && store.get(dismissSetting)))) {
      shown.setVisible(false);
    }
  });

  return Object.freeze({
    ...shown,
    destroy() {
      destroyed = true;
      shown.destroy();
      unsubscribe();
    },
    hasSessionSlot: () => sessionSlotClaimed,
    ready: readyPromise
  });
}

export type { GraphicsNoticeController, GraphicsNoticeOptions, GraphicsNoticeSurface };
export {
  GRAPHICS_NOTICE_ID,
  GRAPHICS_NOTICE_VERSION,
  createGraphicsNotice,
  createGraphicsNoticeDefinition
};
