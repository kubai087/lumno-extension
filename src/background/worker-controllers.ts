// The worker's long-lived controllers that message handlers use: progress
// tracking of pinned cards (Labs), the page context menu item that adds a
// page to the New Tab shortcuts, and the toolbar popup's recent-site pin.
//
// They are created here and started by background.ts, which wires the
// browser events, so starting them keeps its place in the worker's startup.
import * as LumnoProgressHistory from '../domain/progress-history';
import * as LumnoSettings from '../domain/settings';
import * as LumnoPageShortcutMenu from './page-shortcut-menu';
import * as LumnoPopupRecentPin from './popup-recent-pin';
import { createReadLaterController } from './read-later';
import { startReadLaterMenu } from './read-later-menu';
import {
  loadLocaleMessages,
  normalizeHost,
  providerStorageRuntime,
  workerSettings
} from './worker-context';
import * as FaviconCanonical from '../domain/favicon/canonical';
import * as Tracker from './progress/tracker';
import * as RecentSitesStore from '../domain/recent-sites-store';

// Labs: tracked pinned cards follow the episode or chapter the person is on.
function isProgressTrackingEnabled(): boolean {
  return workerSettings.get(LumnoSettings.progressTrackingEnabled);
}

const progressTracker = Tracker.createProgressTracker({
  chromeApi: chrome,
  settingsStore: workerSettings,
  isEnabled: isProgressTrackingEnabled
});

// Attaches the tracker to tab events.
function startProgressTracking(): void {
  progressTracker.attach();
}

// The page context menu item that adds the page to the New Tab shortcuts;
// null where the browser has no context menus.
const pageShortcutMenuController = chrome.contextMenus
  ? LumnoPageShortcutMenu.createController({ chrome, provider: providerStorageRuntime,
    settingsStore: workerSettings, loadLocaleMessages }) : null;

// The popup's pin among the New Tab's recent sites; episodes and chapters
// start tracked while progress tracking (Labs) is on.
const popupRecentPin = LumnoPopupRecentPin.createController({
  store: RecentSitesStore,
  settingsStore: workerSettings,
  storeOptions: {
    normalizeHost,
    getCanonicalPageUrlForFavicon: FaviconCanonical.getCanonicalPageUrlForFavicon,
    maxPinned: 3
  },
  probeSeries: (url) => (isProgressTrackingEnabled() ? progressTracker.probeSeries(url) : Promise.resolve(false)),
  createProgressId: LumnoProgressHistory.createProgressId
});

const readLater = createReadLaterController(workerSettings, popupRecentPin);
function startReadLater(): void {
  startReadLaterMenu(readLater, workerSettings, loadLocaleMessages, pageShortcutMenuController);
}

export {
  readLater,
  startReadLater,
  isProgressTrackingEnabled,
  pageShortcutMenuController,
  popupRecentPin,
  progressTracker,
  startProgressTracking
};
