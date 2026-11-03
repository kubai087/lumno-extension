// The runtime message protocol: every message the extension's pages,
// content scripts and overlay send to the background (BackgroundMessages,
// keyed by `action`), every message the background sends to a tab or page
// (PageMessages), and the reply each one gets.
//
// Replies are input from another context: a receiver checks the fields it
// relies on, since the sender may be an older worker or a page that went
// away before answering.
import type { KeyDescriptor } from './shortcut-key-matcher';
import type { SearchSourceType, SiteSearchProvider, SuggestionLike } from './search/types';
import type { ThemeColorConfidence, ThemeRgb } from './favicon/types';
import type { HelpSearchResult } from './search/help-center/types';

// A message that carries nothing besides its action.
type NoFields = Record<never, never>;

// Where a link opens.
type OpenDisposition = 'currentTab' | 'newTab' | 'backgroundTab' | 'splitTab';

// The reply of most actions: whether it worked, and why not.
interface OkReply {
  ok: boolean;
  reason?: string;
}

// Where a link preview was clicked, in the top frame's viewport; the window
// grows from there.
interface LinkPreviewOrigin {
  x: number;
  y: number;
}

// Whether a refused preview frame loads url again.
interface LinkPreviewRetry {
  retry: boolean;
  url?: string;
}

// The search surface asking, which keeps its suggestion requests apart.
type SearchContext = 'newtab' | 'overlay' | 'popup' | string;

// One entry of a _locales messages.json file.
interface LocaleMessage {
  message: string;
  description?: string;
  placeholders?: Record<string, { content: string; example?: string }>;
}

// An entry of assets/data/shortcut-rules.json: words that open a browser
// page or a site, or narrow search to one local source.
interface ShortcutRule {
  type?: string;
  keys?: string[];
  path?: string;
  url?: string;
  searchSourceType?: string;
}

// How often a tab was switched to, which the overlay's tab list ranks by.
interface TabRankFields {
  _xTabRankScore: number;
  _xTabSwitchCount30m: number;
  _xTabSwitchCount24h: number;
  _xTabDebugEventTotal: number;
  _xTabLastAccessedRaw: number;
  _xTabSortAt: number;
  // Switched to often enough to say so, and the words that say it.
  _xTabRankHighFreq: boolean;
  _xTabRankHint: string;
}

// A tab as the overlay's tab list shows it.
interface OverlayTab extends TabRankFields {
  id: number;
  title: string;
  url: string;
  favIconUrl: string;
  // Which listing it came from, so a late answer cannot replace a newer one.
  _xTabFetchSeq: number;
}

// What the overlay keeps of its input while the page under it loads.
interface OverlayLoadingSession {
  inputValue: string;
  selectionStart: number;
  selectionEnd: number;
  selectionDirection: 'forward' | 'backward' | 'none';
  focused: boolean;
}

interface ShortcutFaviconData {
  // A data: URL, or '' when no icon was found.
  data: string;
  sourceUrl: string;
  width: number;
  height: number;
  vector: boolean;
  pageUrl?: string;
}

interface SiteThemeColor {
  accentRgb: ThemeRgb | null;
  source: string;
  neutral?: boolean;
  confidence?: ThemeColorConfidence;
}

// The page the toolbar popup acts on, named by its tab.
interface PopupTabRequest {
  tabId?: number;
}

interface RecentPinStatus {
  available: boolean;
  pinned: boolean;
  full: boolean;
}

type RecentPinToggleStatus = 'invalid' | 'pinned' | 'unpinned' | 'limit' | 'failed';

interface PageShortcutResult {
  status: 'added' | 'exists' | 'limit' | 'invalid' | 'failed';
  // The toast text shown in the page.
  message: string;
  error?: boolean;
  toastShown?: boolean;
}

// Firefox's "Website appearance": the color scheme pages see; 'auto'
// follows the browser theme.
type WebAppearanceMode = 'auto' | 'light' | 'dark';

interface WebAppearanceState {
  supported: boolean;
  mode: WebAppearanceMode;
  // Lumno may change the setting (no other extension or policy holds it).
  controllable: boolean;
}

// The WebDAV sync operations the options page asks for.
type WebDavOperation =
  | 'status' | 'add' | 'test' | 'save' | 'remove' | 'enable' | 'connect' | 'sync' | 'pause' | 'browser'
  | 'schedule' | 'recover' | 'conflictDetails' | 'restoreBackup' | 'dismissSuggestion';

interface WebDavRequest {
  operation: WebDavOperation;
  // The connection; the only one when absent.
  id?: string;
  // Endpoint, directory, username and app password from the form.
  config?: Record<string, unknown>;
  // How a first sync or a conflict resolves: 'remote', 'local' or 'merge'.
  decision?: string;
  // Enable a connection right after adding it.
  enable?: boolean;
  // Reconnect after saving an enabled connection.
  resume?: boolean;
}

// A WebDAV result: the operation's fields on success, a failure code and
// its redacted diagnostic otherwise.
type WebDavReply =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; error: string; diagnostic?: unknown };

// What an aggregate search run did: the source tabs it opened, the group it
// put them in, and the providers whose prompt it submitted.
interface AggregateSearchReply extends OkReply {
  requestedCount?: number;
  openedCount?: number;
  failedCount?: number;
  // Sources the definition names that are missing or disabled.
  requiredSourceCount?: number;
  availableSourceCount?: number;
  unavailableSourceCount?: number;
  grouped?: boolean;
  groupId?: number | null;
  groupTitleApplied?: boolean;
  activatedTabId?: number | null;
  // The first tab is activated after a short delay that lets the person see
  // the group form.
  activationDeferred?: boolean;
  activationDelayMs?: number;
  interactiveRequestedCount?: number;
  interactiveSucceededCount?: number;
  interactiveFailedCount?: number;
  warnings?: string[];
}

type PipKind = 'video' | 'document';

// The frame that holds picture-in-picture; one at a time across tabs.
interface PipOwner {
  kind: PipKind;
  tabId: number;
  frameId: number;
  token: string;
  url: string;
  updatedAt: number;
}

interface PipOwnershipReply extends OkReply {
  granted: boolean;
  token?: string;
  owner?: PipOwner;
}

// What a page-world picture-in-picture helper reports about the page.
interface PipMainWorldReply extends OkReply {
  // Whether the page showed picture-in-picture before and after.
  before?: boolean;
  after?: boolean;
  attempted?: boolean;
  attemptedExit?: boolean;
  // The player method that worked.
  used?: string;
  unminimized?: boolean;
  // iQIYI: the automatic picture-in-picture handler is set up.
  bound?: boolean;
  preparedVideos?: number;
  error?: string;
}

interface PipReleaseReply extends OkReply {
  released: boolean;
}

interface BookmarkTabGroupReply extends OkReply {
  requestedCount?: number;
  openedCount?: number;
  failedCount?: number;
  groupId?: number | null;
}

// The request fields (besides `action`) and the reply of every background
// action.
interface BackgroundMessages {
  // removed: the browser's New Tab the person was on was closed.
  swapNewtabForFocus: { request: NoFields; reply: OkReply & { removed?: boolean } };
  switchToTab: { request: { tabId: number; windowId?: number | null }; reply: OkReply & { tabId?: number; windowId?: number | null } };
  closeTabFromTabSwitcher: { request: { tabId: number }; reply: OkReply };
  notifyOverlayClosed: { request: NoFields; reply: OkReply };
  notifyTopFrameDocumentStarted: {
    request: { documentUrl: string; documentReadyState: string; observedAt: number };
    reply: OkReply;
  };
  updateOverlayLoadingSession: { request: { session: OverlayLoadingSession }; reply: OkReply & { tracked: boolean } };
  getTabsForOverlay: { request: { currentTabId?: number | null }; reply: { tabs: OverlayTab[]; currentTabId: number | null } };
  trackSearchTab: { request: { tabId: number }; reply: OkReply };
  closeOtherTabsForOverlay: { request: NoFields; reply: OkReply & { closedCount?: number } };
  getShowSearchShortcut: { request: NoFields; reply: { shortcut: string } };
  getCopyCurrentUrlCommandShortcut: { request: NoFields; reply: { shortcut: string } };
  copyCurrentPageUrl: { request: NoFields; reply: OkReply };
  triggerShowSearchFromPageHotkey: {
    request: {
      prefillCurrentUrl?: boolean;
      // A page that cannot know the configured shortcut yet asks the
      // background to check the keys it saw.
      requiresShortcutVerification?: boolean;
      observedShortcut?: KeyDescriptor;
      // The frame the keys were pressed in, and when.
      documentUrl?: string;
      documentIsTop?: boolean;
      observedAt?: number;
      // Sent from a trusted keydown, the path that works when the browser
      // command does not reach the page.
      trustedShortcutFallback?: boolean;
    };
    reply: OkReply & { shortcut: string };
  };
  notifyTabSwitcherShortcutModifierReleased: { request: { key?: string }; reply: OkReply & { committed: boolean } };
  getShortcutRules: { request: NoFields; reply: { items: ShortcutRule[] } };
  getLocaleMessages: {
    request: { locale?: string; keys?: string[] };
    reply: { messages: Record<string, LocaleMessage> };
  };
  getFileSchemeAccessStatus: {
    request: NoFields;
    reply: OkReply & { allowed: boolean; supported: boolean; detailsUrl: string };
  };
  probeProgressSeries: { request: { url: string }; reply: OkReply & { series: boolean } };
  openOptionsPage: { request: { disposition?: OpenDisposition; hash?: string }; reply: OkReply };
  openOnboardingPage: { request: { disposition?: OpenDisposition }; reply: OkReply };
  openReleasePage: { request: { disposition?: OpenDisposition; reason?: string }; reply: OkReply };
  openExtensionShortcutsPage: { request: { disposition?: OpenDisposition }; reply: OkReply };
  openSiteSearchOptionsPage: { request: { disposition?: OpenDisposition }; reply: OkReply };
  openBookmarkManager: { request: NoFields; reply: OkReply & { url?: string } };
  openBookmarkFolderInNewTabGroup: { request: { folderId: string; title?: string }; reply: BookmarkTabGroupReply };
  createTab: { request: { url: string; disposition?: OpenDisposition }; reply: OkReply };
  openNewTab: { request: { disposition?: OpenDisposition }; reply: OkReply };
  openExtensionDetailsPage: { request: { disposition?: OpenDisposition }; reply: OkReply & { url: string } };
  checkGraphicsRendering: { request: NoFields; reply: { rendering: 'hardware' | 'software' | 'unknown' } };
  openGraphicsSettings: { request: { disposition?: OpenDisposition }; reply: OkReply };
  resolveFaviconCandidates: {
    request: {
      url: string;
      host?: string;
      fallbackUrl?: string;
      preferredTheme?: string;
      excludeChromeFallback?: boolean;
      forceFresh?: boolean;
    };
    reply: { urls: string[] };
  };
  getFaviconData: { request: { url: string; pageUrl?: string }; reply: { data: string } };
  getShortcutFaviconData: {
    request: { pageUrl: string; preferredTheme?: string; refresh?: boolean; iconSource?: string };
    reply: ShortcutFaviconData;
  };
  resolveSiteThemeColor: { request: { url: string; host?: string; preferredTheme?: string }; reply: SiteThemeColor };
  popupOpenDocumentPipPicker: { request: PopupTabRequest; reply: OkReply };
  popupShowSearch: { request: PopupTabRequest; reply: OkReply };
  popupShowPageToast: { request: PopupTabRequest & { message: string }; reply: OkReply };
  popupAddPageShortcut: { request: PopupTabRequest; reply: PageShortcutResult };
  popupGetRecentPin: { request: PopupTabRequest; reply: RecentPinStatus };
  // tracking: the pinned page's progress is followed too.
  popupToggleRecentPin: { request: PopupTabRequest; reply: { status: RecentPinToggleStatus; tracking?: boolean } };
  pipRequestOwnership: { request: { kind: string }; reply: PipOwnershipReply };
  pipReleaseOwnership: { request: { token: string }; reply: PipReleaseReply };
  openDocumentPipPicker: { request: NoFields; reply: OkReply & { enabled?: boolean } };
  siteTryEnterPiPInMainWorld: { request: NoFields; reply: PipMainWorldReply };
  iqiyiTryEnterPiPInMainWorld: { request: NoFields; reply: PipMainWorldReply };
  iqiyiSetupAutoPiPInMainWorld: { request: NoFields; reply: PipMainWorldReply };
  forceExitPiPInMainWorld: { request: NoFields; reply: PipMainWorldReply };
  ytForceExitPiPInMainWorld: { request: NoFields; reply: PipMainWorldReply };
  runSelectionQuickAction: { request: { text: string; intent?: string; locale?: string }; reply: OkReply };
  searchOrNavigate: {
    request: { query: string; forceSearch?: boolean; disposition?: OpenDisposition };
    reply: OkReply & { url?: string };
  };
  getSearchSuggestions: {
    request: { query: string; context?: SearchContext; sourceTypes?: SearchSourceType[]; includeOpenTabs?: boolean };
    reply: { suggestions: SuggestionLike[] };
  };
  getSearchEngineSuggestions: {
    request: { query: string; context?: SearchContext; localSuggestions?: SuggestionLike[]; searchFirst?: boolean };
    reply: { suggestions: SuggestionLike[]; aborted: boolean; hasRemoteSuggestions: boolean };
  };
  recordSearchSuggestionSelection: {
    request: { query: string; url: string; title?: string; type?: string; source?: string };
    reply: OkReply;
  };
  deleteHistoryUrl: { request: { url: string }; reply: OkReply & { url?: string } };
  getSiteSearchProviders: { request: NoFields; reply: { items: SiteSearchProvider[]; reason?: string } };
  getHelpCenterSearchResults: { request: { query: string; locale?: string }; reply: { items: HelpSearchResult[]; reason?: string } };
  runSiteSearchProviderQuery: {
    request: { provider: SiteSearchProvider; query: string; disposition?: OpenDisposition };
    reply: OkReply;
  };
  runAggregateSearchQuery: {
    request: { aggregateId: string; query: string; disposition?: OpenDisposition };
    reply: AggregateSearchReply;
  };
  // A press on a link, or Shift held over one (hover), which skips the screenshot.
  linkPreviewPrepare: { request: { url: string; hover?: boolean }; reply: OkReply };
  linkPreviewOpen: { request: { url: string; origin?: LinkPreviewOrigin }; reply: OkReply };
  // The press was released away from the link.
  linkPreviewCancel: { request: NoFields; reply: OkReply };
  linkPreviewClose: { request: { token?: string }; reply: OkReply };
  // `split` opens it in a split view beside the page where the browser can.
  linkPreviewOpenInTab: { request: { url: string; split?: boolean }; reply: OkReply };
  // Sent by the preview frame: the secret binds it, then it reports where it goes.
  linkPreviewFrameBind: { request: { secret: string }; reply: OkReply };
  linkPreviewFrameNavigating: { request: { url: string }; reply: OkReply };
  linkPreviewFrameCommitted: { request: NoFields; reply: OkReply };
  // The surface found the frame refused; the reply says whether to load url again.
  linkPreviewFrameRefused: { request: { token: string }; reply: LinkPreviewRetry };
  getWebAppearance: { request: NoFields; reply: WebAppearanceState };
  setWebAppearance: { request: { mode: WebAppearanceMode }; reply: OkReply & { mode?: WebAppearanceMode; controllable?: boolean } };
  webdav: { request: WebDavRequest; reply: WebDavReply };
}

type BackgroundAction = keyof BackgroundMessages;

type BackgroundRequest<A extends BackgroundAction = BackgroundAction> = {
  [K in A]: { action: K } & BackgroundMessages[K]['request'];
}[A];

type BackgroundReply<A extends BackgroundAction> = BackgroundMessages[A]['reply'];

// '' when the tab has never been captured.
type TabSwitcherThumbnailStatus = 'ok' | 'pending' | 'missing' | 'stale' | 'failed' | 'restricted' | '';

// A tab as the tab switcher lists it.
interface TabSwitcherItem {
  id: number;
  windowId: number | null;
  url: string;
  title: string;
  favIconUrl: string;
  accentRgb: ThemeRgb | null;
  active: boolean;
  pinned: boolean;
  current: boolean;
  thumbnail: string;
  thumbnailStatus: TabSwitcherThumbnailStatus;
  thumbnailReason: string;
}

// What the tab switcher opens with.
interface TabSwitcherContext {
  tabs: TabSwitcherItem[];
  currentTabId: number;
  selectedIndex: number;
  // The page's zoom, which the switcher undoes to keep its size.
  tabZoomFactor: number;
  advanceOnExisting: boolean;
  suppressInitialShortcutAdvance: boolean;
  shortcut: string;
  // Opened by the reverse command, on the oldest tab.
  reverse: boolean;
  source: string;
}

// What the search overlay opens with, handed to its toggle in the page.
interface OverlayOpenContext {
  // The page's zoom, which the overlay undoes to keep its size.
  tabZoomFactor: number;
  prefillQuery: string;
  prioritizeCurrentPageMatch: boolean;
  currentTabId: number | null;
  currentTabUrl: string;
  // Results meant for the current tab open in a new one instead.
  currentTabPinned: boolean;
  // When the user started waiting, for the entry motion's budget.
  openedAt: number;
  documentPipEnabled: boolean;
  siteSearchProviders: SiteSearchProvider[];
  // Open even when an overlay is already showing, instead of toggling it.
  ensureOpen: boolean;
  loadingSessionTracked: boolean;
  // The input to restore after the page loaded under the overlay.
  loadingSession: OverlayLoadingSession | null;
}

interface TabSwitcherThumbnailUpdate {
  tabId: number;
  url: string;
  thumbnail: string;
  thumbnailStatus: TabSwitcherThumbnailStatus;
  thumbnailReason: string;
}

// The request fields (besides `action`) and the reply of every message the
// background sends to a tab's content scripts or to extension pages.
interface PageMessages {
  // Another tab takes picture-in-picture over; the owner closes its window.
  'lumno:pip-force-surrender': { request: { reason: string; ownerKind: string }; reply: OkReply };
  copyCurrentPageUrlFromCommand: { request: NoFields; reply: OkReply };
  // The keys whose release commits the switcher, sent to every tab of the window.
  armTabSwitcherShortcutRelease: { request: { keys: string[]; commandStartedAt: number }; reply: OkReply };
  openTabSwitcherFromCommand: { request: { context: TabSwitcherContext }; reply: OkReply };
  advanceOpenTabSwitcherFromCommand: { request: { offset: number }; reply: OkReply & { advanced?: boolean } };
  commitOpenTabSwitcherFromShortcutRelease: { request: NoFields; reply: OkReply & { committed: boolean } };
  setTabSwitcherCaptureVisibility: { request: { hidden: boolean }; reply: OkReply };
  getOpenTabSwitcherState: { request: NoFields; reply: { ok: boolean; open: boolean } };
  updateTabSwitcherThumbnail: { request: TabSwitcherThumbnailUpdate; reply: OkReply };
  // The link preview surface answers whether it took the request.
  // `splitView` says whether the preview can move into a split view.
  lumnoLinkPreviewPrewarm: { request: { token: string; url: string; frameSecret: string; splitView: boolean }; reply: boolean };
  lumnoLinkPreviewScreenshot: { request: { token: string; screenshot: string }; reply: boolean };
  lumnoLinkPreviewShow: {
    request: { token: string; url: string; frameSecret: string; screenshot: string; origin: LinkPreviewOrigin | null; splitView: boolean };
    reply: boolean;
  };
  // A press released away from the link drops the preview it prepared.
  lumnoLinkPreviewDiscard: { request: { token: string }; reply: boolean };
  // The token of the preview on screen, or '' with none.
  lumnoLinkPreviewPing: { request: NoFields; reply: { token: string } };
  'lumno:newtab-focus-input': { request: { source: string; tabId: number | null }; reply: OkReply };
  'lumno:newtab-refresh-sections': { request: { section: 'recent' | 'bookmarks' | 'all' | string }; reply: void };
  triggerOnboardingSearchOverlayFromCommand: { request: { tabId: number; source: string }; reply: OkReply };
}

type PageAction = keyof PageMessages;

type PageRequest<A extends PageAction = PageAction> = {
  [K in A]: { action: K } & PageMessages[K]['request'];
}[A];

type PageReply<A extends PageAction> = PageMessages[A]['reply'];

export type {
  AggregateSearchReply,
  BackgroundAction,
  BackgroundMessages,
  BackgroundReply,
  BackgroundRequest,
  BookmarkTabGroupReply,
  LinkPreviewOrigin,
  LinkPreviewRetry,
  LocaleMessage,
  NoFields,
  OkReply,
  OpenDisposition,
  OverlayLoadingSession,
  OverlayTab,
  PageAction,
  PageMessages,
  PageReply,
  PageRequest,
  PageShortcutResult,
  PipKind,
  PipMainWorldReply,
  PipOwner,
  PipOwnershipReply,
  PipReleaseReply,
  PopupTabRequest,
  RecentPinStatus,
  RecentPinToggleStatus,
  SearchContext,
  ShortcutFaviconData,
  ShortcutRule,
  SiteThemeColor,
  TabRankFields,
  TabSwitcherContext,
  OverlayOpenContext,
  TabSwitcherItem,
  TabSwitcherThumbnailStatus,
  TabSwitcherThumbnailUpdate,
  WebAppearanceMode,
  WebAppearanceState,
  WebDavOperation,
  WebDavReply,
  WebDavRequest
};
