// The panel mounted into the page: the language, engine and catalog follows,
// the page theme read before anything moves the layout, the font faces, the
// panel's host, shadow root and styles, the toast, the copy action and the
// reveal gate. Null when the panel cannot be mounted.
import * as OVERLAY_TOAST from '../../../shared/ui/toast';
import { createToastStyleGate } from '../../../shared/ui/toast-style-gate';
import * as LumnoOverlayLifecycle from '../../lifecycle';
import * as PANEL_COPY_ACTIONS from '../../panel/copy-actions';
import * as LumnoOverlaySiteFixes from '../../site-fixes';
import { getOverlayStyleUrls } from '../../style-urls';
import { appendOverlayStyleNodes, createOverlayMount } from '../../react/shell';
import { overlaySizeMode } from '../../../domain/settings/overlay-panel';
import { OVERLAY_HOST_ID, OVERLAY_PANEL_ID } from '../../../domain/injected-commands';
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';
import type { PanelFeature } from '../panel';
import type { ControlsFeature } from '../controls';

interface PanelMountPartDeps {
  core: CoreFeature;
  panel: PanelFeature;
  controls: ControlsFeature;
}

function createPanelMountPart(ctx: OverlayContext, deps: PanelMountPartDeps) {
  const { elements, locale, settings, t } = ctx;
  const addOverlaySessionCleanup = ctx.overlaySessionCleanups.add;
  const { applyNoTranslate, getOverlaySizePreset, overlayToast } = deps.core;
  const { colorScheme, searchEngine, siteSearchCatalog } = deps.core;
  const {
    attachRevealGate,
    closeOverlayWithMotion,
    detectPageTheme,
    removeOverlay,
    setOverlayMountVisibility,
    setOverlayStoredContextToken
  } = deps.panel;
  const { ensureOverlayFontFaces } = deps.controls;

  addOverlaySessionCleanup(locale.follow());
  addOverlaySessionCleanup(searchEngine.follow());
  addOverlaySessionCleanup(siteSearchCatalog.follow());
  // Read the page theme while the page's layout is still settled: the font
  // faces and the overlay host below each invalidate it, and sampling the
  // page after them pays for a full style and layout pass.
  detectPageTheme();
  ensureOverlayFontFaces();
  const overlayStyleUrls = getOverlayStyleUrls();
  const initialOverlaySizePreset = getOverlaySizePreset(settings.get(overlaySizeMode));
  const overlayMount = createOverlayMount(document, {
    hostId: OVERLAY_HOST_ID,
    id: OVERLAY_PANEL_ID,
    width: initialOverlaySizePreset.width,
    maxHeightVh: initialOverlaySizePreset.maxHeightVh,
    ...overlayStyleUrls
  });
  if (!overlayMount) {
    console.warn('Lumno: overlay mount could not be created.');
    return null;
  }
  elements.mountShell(overlayMount);
  const overlayHost = overlayMount.host;
  // The panel's shadow root, which holds its styles.
  const overlayStyleRoot = overlayMount.root;
  setOverlayStoredContextToken(elements.overlay);
  addOverlaySessionCleanup(LumnoOverlayLifecycle.onSessionDestroyRequest(overlayHost, (options) => {
    if (options.animateExit === true) closeOverlayWithMotion(elements.overlay);
    else removeOverlay(elements.overlay, options);
  }));
  overlayMount.panel.classList.add('x-lumno-search-entry');
  setOverlayMountVisibility(overlayHost, true);
  applyNoTranslate(elements.overlay);

  appendOverlayStyleNodes(document, {
    root: overlayStyleRoot,
    ...overlayStyleUrls
  });
  const overlayToastElement = applyNoTranslate(document.createElement('div'));
  overlayToastElement.id = '_x_extension_overlay_toast_2026_unique_';
  overlayToastElement.className = '_x_extension_overlay_toast_2026_unique_ x-lumno-toast';
  overlayToastElement.style.setProperty(
    '--x-lumno-toast-top',
    'max(24px, calc(20vh - 48px))'
  );
  overlayToastElement.style.setProperty('--x-lumno-toast-z-index', '2147483647');
  overlayToastElement.setAttribute('data-show', 'false');
  overlayToastElement.setAttribute('role', 'status');
  overlayToastElement.setAttribute('aria-live', 'polite');
  const overlayToastStylesheet = overlayStyleRoot
    .getElementById('_x_extension_toast_style_2026_unique_');
  const overlayToastStyleGate = createToastStyleGate(
    overlayToastElement,
    {
      windowObj: window,
      stylesheetElement: overlayToastStylesheet
    }
  );
  overlayStyleRoot.appendChild(overlayToastElement);
  const drawToastScheme = () => {
    overlayToastElement.setAttribute('data-theme', colorScheme.getSnapshot().dark ? 'dark' : 'light');
  };
  drawToastScheme();
  addOverlaySessionCleanup(colorScheme.subscribe(drawToastScheme));
  const overlayToastController = OVERLAY_TOAST.createToastController(
    overlayToastElement,
    { windowObj: window }
  );
  overlayToast.mount(overlayToastController);
  addOverlaySessionCleanup(() => {
    overlayToastStyleGate.destroy();
    overlayToastController.destroy();
  });

  const {
    copySearchResultUrl
  } = PANEL_COPY_ACTIONS.createCopyActions({
    overlayToast,
    t
  });

  const overlayRevealGate = LumnoOverlaySiteFixes.createOverlayRevealGate(window, {
    overlay: overlayMount.panel,
    styleRoot: overlayStyleRoot
  });
  attachRevealGate(overlayRevealGate);

  return {
    copySearchResultUrl,
    overlayHost,
    overlayMount,
    overlayRevealGate,
    overlayStyleRoot
  };
}

type PanelMountPart = NonNullable<ReturnType<typeof createPanelMountPart>>;

export { createPanelMountPart };
export type { PanelMountPart };
