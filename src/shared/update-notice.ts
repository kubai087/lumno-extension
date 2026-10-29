// The "updated to vX" notice under the search box of New Tab and the overlay.
// Its data (the published notice, the setting, display counts) lives in
// platform/update-notice.ts, re-exported here for the surfaces.
import * as LumnoFeatureHints from './ui/feature-hints';
import { createSettingsStore, getContextSettingsStore } from '../platform/settings-store';
import type { SettingsStore } from '../platform/settings-store';
import { UPDATE_NOTICE_MAX_DISPLAY_COUNT, RELEASE_DETAILS_URL, GITHUB_RELEASE_API_URL, GITHUB_RELEASE_PAGE_URL, normalizeVersionTag, formatVersionLabel, getReleaseTagCandidates, sanitizeText, extractReleaseTitleFromHtml, getCurrentVersionTag, buildReleaseDetailsUrl, normalizeUpdateNoticePayload, shouldShowUpdateNotice, normalizeUpdateNoticeEnabled, getUpdateNoticeDisplayCountKey, getUpdateNoticeDisplayCountSetting, normalizeUpdateNoticeDisplayCount, getStoredUpdateNotice, getStoredUpdateNoticeEnabled, getStoredUpdateNoticeDisplayCount, setStoredUpdateNotice, fetchReleaseTitle, publishUpdateNotice } from '../platform/update-notice';
import type { ReleaseFetch, UpdateNotice, UpdateNoticeChromeApi } from '../platform/update-notice';
import type { FeatureHintController, FeatureHintDefinition } from './ui/feature-hint-catalog';
import { getFeatureHintSyncDismissKey } from './ui/feature-hint-dismiss';
import type { Setting } from '../domain/settings/define';
import { featureHintDismissedEverywhere, updateNoticeEnabled as updateNoticeEnabledSetting, updateNoticeState } from '../domain/settings/features';
import type { PortalHost } from './react/portal-host';

type UpdateNoticeSurface = 'newtab' | 'overlay' | 'shared';

type Translate = (key: string, fallback: string) => string;

interface UpdateNoticeOptions {
  // The surface's React root, which draws the notice.
  portals: PortalHost;
  documentObj?: Document | null;
  windowObj?: Partial<Pick<Window, 'open'>> | null;
  chromeApi?: UpdateNoticeChromeApi | null;
  // The page's settings store; the context's shared one when absent.
  settingsStore?: SettingsStore | null;
  featureHints?: Pick<typeof LumnoFeatureHints, 'createFeatureHint'> | null;
  // This version; the manifest's when absent.
  version?: string;
  surface?: string;
  t?: Translate;
  // The stored notice and setting when the page already read them.
  initialNotice?: unknown;
  updateNoticeEnabled?: unknown;
  fetchImpl?: ReleaseFetch | null;
  onDetailsClick?(notice: UpdateNotice | null, event: MouseEvent): void;
  onDismiss?(): void;
  // The notice showed, so other notices this page view should wait.
  onSessionSlotClaimed?(): void;
}

interface UpdateNoticeController extends Omit<FeatureHintController, 'ready'> {
  applyNoticePayload(payload: unknown): void;
  getNotice(): UpdateNotice | null;
  getDisplayCount(): number;
  hasSessionSlot(): boolean;
  // Counts this showing towards the limit; resolves to whether it counted.
  recordExposure(): Promise<boolean>;
  // Resolves to whether the notice claimed this page view's notice slot.
  ready: Promise<boolean>;
  getDetailsUrl(): string;
}

const UPDATE_NOTICE_ID = 'update-notice';

function formatTemplate(template: string, params: Record<string, string>): string {
  let text = String(template || '');
  Object.keys(params).forEach((key) => {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), params[key]);
  });
  return text;
}

function stripBadgeButterfly(value: string): string {
  return String(value || '').replace(/^(?:\s*🦋\s*)+/u, '').trim();
}

function readSurface(surface: unknown): UpdateNoticeSurface {
  return surface === 'overlay' ? 'overlay' : (surface === 'newtab' ? 'newtab' : 'shared');
}

function createUpdateNoticeDefinition(
  versionTag: unknown,
  options?: { surface?: string } | null
): Readonly<FeatureHintDefinition> {
  const surface = readSurface(options ? options.surface : undefined);
  const className = surface === 'shared'
    ? 'x-lumno-feature-hint--update-notice'
    : `x-lumno-feature-hint--update-notice x-lumno-feature-hint--update-notice-${surface}`;
  return Object.freeze({
    id: UPDATE_NOTICE_ID,
    introducedIn: normalizeVersionTag(versionTag),
    surface,
    placement: surface === 'overlay' ? 'above search input' : 'below search input',
    className,
    arrowSide: surface === 'overlay' ? 'bottom' : 'top',
    arrowAlign: 'center',
    widthMode: 'container',
    alignMode: 'auto',
    dismissStorage: 'sync',
    rememberOnFirstShow: false,
    badgeIconText: '🦋',
    badgeKey: 'update_notice_badge',
    badgeFallback: '已更新至 {version}',
    textKey: 'update_notice_text',
    textFallback: '查看本次更新',
    linkKey: 'update_notice_link',
    linkFallback: '更新日志',
    closeLabelKey: 'update_notice_close',
    closeLabelFallback: '关闭更新提示'
  });
}

// The key that remembers the notice of this version was dismissed.
function getUpdateNoticeDismissKey(versionTag: unknown): string {
  return getFeatureHintSyncDismissKey(createUpdateNoticeDefinition(versionTag));
}

// The notice's copy for the version, with the release's own title once
// it is known.
function translateNotice(baseT: Translate, key: string, fallback: string, notice: UpdateNotice | null, displayVersion: string): string {
  if (key === 'update_notice_badge') {
    return stripBadgeButterfly(formatTemplate(baseT(key, fallback || '已更新至 {version}'), { version: displayVersion }));
  }
  if (key === 'update_notice_text') {
    return notice && notice.title
      ? notice.title
      : formatTemplate(baseT('update_notice_text_fallback', fallback || '查看本次更新'), { version: displayVersion });
  }
  if (key === 'update_notice_link') {
    return baseT(key, fallback || '更新日志');
  }
  if (key === 'update_notice_close') {
    return baseT(key, fallback || '关闭更新提示');
  }
  return baseT(key, fallback);
}

// What the options settle for this version's notice.
interface UpdateNoticeSettings {
  readonly config: UpdateNoticeOptions;
  readonly store: SettingsStore;
  readonly currentVersion: string;
  readonly displayVersion: string;
  readonly baseT: Translate;
  readonly displayCountSetting: Setting<unknown>;
  // The per-version dismissal, written once the notice has shown its last time.
  readonly dismissSetting: Setting<boolean> | null;
}

// How many times this version's notice has shown, counted once per page
// view and only once the stored count is known.
class DisplayCount {
  count = 0;
  loaded = false;
  requested = false;
  recorded = false;
  // The dismissal this count wrote, so its own change does not close the notice.
  writingDismissal = false;

  limitReached(): boolean {
    return this.loaded && this.count >= UPDATE_NOTICE_MAX_DISPLAY_COUNT && !this.recorded;
  }

  load(count: number): void {
    this.count = count;
    this.loaded = true;
  }
}

class UpdateNoticeSession {
  notice: UpdateNotice | null;
  sessionSlotClaimed = false;
  readonly display = new DisplayCount();
  private enabled: boolean;
  private destroyed = false;
  private titleRefresh: Promise<void> | null = null;
  readonly settings: UpdateNoticeSettings;

  constructor(settings: UpdateNoticeSettings) {
    const { config, currentVersion } = settings;
    this.settings = settings;
    this.notice = shouldShowUpdateNotice(config.initialNotice, currentVersion) ? normalizeUpdateNoticePayload(config.initialNotice) : null;
    this.enabled = normalizeUpdateNoticeEnabled(config.updateNoticeEnabled);
  }

  translate(key: string, fallback: string): string {
    return translateNotice(this.settings.baseT, key, fallback, this.notice, this.settings.displayVersion);
  }

  activeNotice(): UpdateNotice | null {
    const version = this.settings.currentVersion;
    return this.notice || normalizeUpdateNoticePayload({
      version,
      reason: 'update',
      releaseUrl: buildReleaseDetailsUrl(version, { reason: 'update' })
    });
  }

  openDetails(event: MouseEvent): void {
    const { config } = this.settings;
    const activeNotice = this.activeNotice();
    if (typeof config.onDetailsClick === 'function') {
      config.onDetailsClick(activeNotice, event);
      return;
    }
    const url = activeNotice && activeNotice.releaseUrl ? activeNotice.releaseUrl : '';
    const windowObj = config.windowObj || (typeof window !== 'undefined' ? window : null);
    if (url && windowObj && typeof windowObj.open === 'function') {
      windowObj.open(url, '_blank', 'noopener');
    }
  }

  // Reads the stored notice, setting and count; settles once they are applied.
  load(hint: FeatureHintController): Promise<void> {
    const { store, currentVersion } = this.settings;
    return Promise.all([
      getStoredUpdateNotice(store),
      getStoredUpdateNoticeEnabled(store),
      getStoredUpdateNoticeDisplayCount(store, currentVersion)
    ]).then(([payload, enabled, storedDisplayCount]) => {
      this.enabled = enabled;
      this.display.load(storedDisplayCount);
      this.syncDisplayCountAttribute(hint);
      this.applyPayload(hint, payload);
    });
  }

  applyPayload(hint: FeatureHintController, payload: unknown): void {
    if (this.destroyed) {
      return;
    }
    this.notice = shouldShowUpdateNotice(payload, this.settings.currentVersion) ? normalizeUpdateNoticePayload(payload) : null;
    this.syncVisibility(hint);
  }

  // Follows the setting, the published notice, the count and the dismissal
  // other pages write; returns the unsubscribe.
  follow(hint: FeatureHintController): () => void {
    const { store, displayCountSetting, dismissSetting } = this.settings;
    const followed: Setting<unknown>[] = [updateNoticeEnabledSetting, updateNoticeState, displayCountSetting];
    if (dismissSetting) followed.push(dismissSetting);
    return store.subscribe(followed, (setting) => {
      if (this.destroyed) {
        return;
      }
      if (setting === updateNoticeEnabledSetting) {
        this.enabled = normalizeUpdateNoticeEnabled(store.getStored(updateNoticeEnabledSetting));
        this.syncVisibility(hint);
      } else if (setting === updateNoticeState) {
        this.applyPayload(hint, store.getStored(updateNoticeState));
      } else if (setting === displayCountSetting) {
        this.display.load(normalizeUpdateNoticeDisplayCount(store.getStored(displayCountSetting)));
        this.syncDisplayCountAttribute(hint);
        if (!this.display.recorded) this.syncVisibility(hint);
      } else if (dismissSetting && store.get(dismissSetting) && !this.display.writingDismissal && !hint.isDismissed()) {
        hint.dismiss();
      }
    });
  }

  claimSessionSlotIfVisible(hint: FeatureHintController): void {
    const onClaimed = this.settings.config.onSessionSlotClaimed;
    if (this.destroyed || this.sessionSlotClaimed || !hint.isVisible()) {
      return;
    }
    this.sessionSlotClaimed = true;
    if (typeof onClaimed === 'function') {
      onClaimed();
    }
  }

  // Counts this showing, once, while the notice shows. The last allowed
  // showing also writes the per-version dismissal, so later New Tab and
  // overlay pages start dismissed while this one stays visible.
  recordExposureIfVisible(hint: FeatureHintController): boolean {
    const display = this.display;
    if (this.destroyed || display.recorded || !display.requested || !display.loaded || !hint.isVisible()) {
      return false;
    }
    const { store, displayCountSetting, dismissSetting } = this.settings;
    display.recorded = true;
    display.count = normalizeUpdateNoticeDisplayCount(display.count + 1);
    this.syncDisplayCountAttribute(hint);
    const values: Array<[Setting<unknown>, unknown]> = [[displayCountSetting, display.count]];
    if (display.count >= UPDATE_NOTICE_MAX_DISPLAY_COUNT && dismissSetting) {
      values.push([dismissSetting, true]);
      display.writingDismissal = true;
    }
    store.setMany(values).catch(() => {});
    display.writingDismissal = false;
    return true;
  }

  destroy(hint: FeatureHintController, unsubscribe: () => void): void {
    this.destroyed = true;
    hint.destroy();
    unsubscribe();
  }

  private syncDisplayCountAttribute(hint: FeatureHintController): void {
    hint.element.setAttribute('data-update-notice-display-count', String(this.display.count));
    hint.element.setAttribute('data-update-notice-display-limit', String(UPDATE_NOTICE_MAX_DISPLAY_COUNT));
  }

  private syncVisibility(hint: FeatureHintController): void {
    hint.updateLanguage();
    hint.setVisible(Boolean(this.enabled && this.notice && this.display.loaded && !this.display.limitReached()));
    this.claimSessionSlotIfVisible(hint);
    this.recordExposureIfVisible(hint);
    if (this.enabled) {
      this.refreshMissingTitle(hint);
    }
  }

  // A notice published without a title reads it from the release page.
  private refreshMissingTitle(hint: FeatureHintController): void {
    const notice = this.notice;
    if (this.destroyed || !notice || notice.title || this.titleRefresh) {
      return;
    }
    this.titleRefresh = fetchReleaseTitle(notice.version, { fetchImpl: this.settings.config.fetchImpl })
      .then((title) => {
        this.titleRefresh = null;
        const sanitizedTitle = sanitizeText(title || '');
        const current = this.notice;
        if (this.destroyed || !sanitizedTitle || !current || current.title) {
          return;
        }
        const nextNotice = normalizeUpdateNoticePayload({ ...current, title: sanitizedTitle });
        if (nextNotice) {
          this.notice = nextNotice;
          hint.updateLanguage();
          void setStoredUpdateNotice(this.settings.store, nextNotice);
        }
      })
      .catch(() => {
        this.titleRefresh = null;
      });
  }
}

function readUpdateNoticeSettings(config: UpdateNoticeOptions, chromeApi: UpdateNoticeChromeApi | null, currentVersion: string): UpdateNoticeSettings {
  const dismissId = featureHintDismissedEverywhere.idOf(getUpdateNoticeDismissKey(currentVersion));
  return {
    config,
    store: config.settingsStore ||
      (chromeApi ? getContextSettingsStore(chromeApi) : createSettingsStore({ chromeApi: null, settings: [] })),
    currentVersion,
    displayVersion: formatVersionLabel(currentVersion),
    baseT: typeof config.t === 'function' ? config.t : (_key, fallback) => fallback || '',
    displayCountSetting: getUpdateNoticeDisplayCountSetting(currentVersion),
    dismissSetting: dismissId ? featureHintDismissedEverywhere.member(dismissId) : null
  };
}

function createUpdateNotice(options: UpdateNoticeOptions): UpdateNoticeController | null {
  const config = options;
  const documentObj = config.documentObj || (typeof document !== 'undefined' ? document : null);
  const chromeApi: UpdateNoticeChromeApi | null = config.chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
  const currentVersion = normalizeVersionTag(config.version || getCurrentVersionTag(chromeApi));
  if (!documentObj || !currentVersion) {
    return null;
  }
  const session = new UpdateNoticeSession(readUpdateNoticeSettings(config, chromeApi, currentVersion));
  const hint = (config.featureHints || LumnoFeatureHints).createFeatureHint({
    portals: config.portals,
    documentObj,
    definition: createUpdateNoticeDefinition(currentVersion, { surface: readSurface(config.surface) }),
    chromeApi,
    dismissKey: getUpdateNoticeDismissKey(currentVersion),
    t: (key, fallback) => session.translate(key, fallback),
    initiallyVisible: false,
    onLinkClick: (event) => session.openDetails(event),
    onDismiss() {
      if (typeof config.onDismiss === 'function') {
        config.onDismiss();
      }
    }
  });
  if (!hint) {
    return null;
  }
  const ready: Promise<boolean> = Promise.all([session.load(hint), hint.ready]).then(() => {
    session.claimSessionSlotIfVisible(hint);
    return session.sessionSlotClaimed;
  });
  const unsubscribe = session.follow(hint);
  return Object.freeze({
    ...hint,
    applyNoticePayload: (payload: unknown) => session.applyPayload(hint, payload),
    destroy: () => session.destroy(hint, unsubscribe),
    getNotice: () => session.notice,
    getDisplayCount: () => session.display.count,
    hasSessionSlot: () => session.sessionSlotClaimed,
    isVisible: () => hint.isVisible(),
    recordExposure() {
      const wasRecorded = session.display.recorded;
      session.display.requested = true;
      return ready.then(() => session.recordExposureIfVisible(hint) || (!wasRecorded && session.display.recorded));
    },
    ready,
    getDetailsUrl() {
      const activeNotice = session.activeNotice();
      return activeNotice ? activeNotice.releaseUrl : '';
    }
  });
}

export type { UpdateNoticeController, UpdateNoticeOptions, UpdateNoticeSurface };

export {
  UPDATE_NOTICE_MAX_DISPLAY_COUNT,
  RELEASE_DETAILS_URL,
  GITHUB_RELEASE_API_URL,
  GITHUB_RELEASE_PAGE_URL,
  normalizeVersionTag,
  formatVersionLabel,
  getReleaseTagCandidates,
  extractReleaseTitleFromHtml,
  getCurrentVersionTag,
  buildReleaseDetailsUrl,
  normalizeUpdateNoticePayload,
  shouldShowUpdateNotice,
  normalizeUpdateNoticeEnabled,
  createUpdateNoticeDefinition,
  getUpdateNoticeDismissKey,
  getUpdateNoticeDisplayCountKey,
  normalizeUpdateNoticeDisplayCount,
  getStoredUpdateNotice,
  getStoredUpdateNoticeEnabled,
  getStoredUpdateNoticeDisplayCount,
  setStoredUpdateNotice,
  fetchReleaseTitle,
  publishUpdateNotice,
  createUpdateNotice
};
