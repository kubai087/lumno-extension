// The runtime instances every overlay feature takes: how this opening was
// asked for, the settings and language, the panel's mounted parts, the
// window's tabs and the session's cleanups.
import { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { loadExtensionLocaleMessages } from '../../shared/i18n/locale-messages';
import { OpenTabs } from '../../shared/search-panel/open-tabs';
import { createSessionCleanupRegistry } from '../lifecycle';
import { readOverlayOpenOptions, readOverlayTabs } from '../overlay-context';
import type { OverlayOpenOptions } from '../overlay-context';
import { createOverlaySettings } from '../overlay-settings';
import type { OverlaySettings } from '../overlay-settings';
import { OverlayPanelElements } from '../panel/panel-elements';

interface OverlayContext {
  openOptions: OverlayOpenOptions;
  settings: OverlaySettings;
  locale: SurfaceLocale;
  t: SurfaceLocale['t'];
  formatMessage: SurfaceLocale['formatMessage'];
  elements: OverlayPanelElements;
  overlayTabs: OpenTabs;
  // Teardown steps owned by this opening's session, run when it closes.
  overlaySessionCleanups: ReturnType<typeof createSessionCleanupRegistry>;
}

// Reads the window's tabs and the context the overlay was opened with, both
// untrusted, and makes the session's settings, language and holders.
function createOverlayContext(requestedTabs: unknown, openContext: unknown): OverlayContext {
  const openOptions = readOverlayOpenOptions(openContext, Date.now());
  const settings = createOverlaySettings(chrome);
  // It follows storage only once the panel mounts.
  const locale = new SurfaceLocale(settings.store, loadExtensionLocaleMessages);
  const { t, formatMessage } = locale;
  return {
    openOptions,
    settings,
    locale,
    t,
    formatMessage,
    elements: new OverlayPanelElements(),
    overlayTabs: new OpenTabs(readOverlayTabs(requestedTabs), openOptions.currentTabId),
    overlaySessionCleanups: createSessionCleanupRegistry()
  };
}

export { createOverlayContext };
export type { OverlayContext };
