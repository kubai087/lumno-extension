// The in-page feature hints ("New: ..." notes beside a control) and the
// shape of their definitions and controllers.
import * as LumnoShortcutDisplay from '../../domain/shortcut-display';
import type { RemixIconName, RemixIconSpec } from './remix-icon';
import type { NavigatorLike } from '../../domain/shortcut-display';
import type { SettingsStoreChromeApi } from '../../platform/settings-areas';
import type { PortalHost } from '../react/portal-host';

type FeatureHintArrowSide = 'top' | 'right' | 'bottom' | 'left';
type FeatureHintArrowAlign = 'start' | 'center' | 'end';
// Where a dismissal is remembered; 'none' forgets it with the page.
type FeatureHintDismissStorage = 'none' | 'session' | 'local' | 'sync';
type FeatureHintWidthMode = 'fixed' | 'container' | 'content';
type FeatureHintAlignMode = 'center' | 'start' | 'auto';

// A button the hint offers besides its link.
interface FeatureHintAction {
  id?: string;
  actionId?: string;
  icon?: RemixIconName;
  labelKey?: string;
  labelFallback?: string;
  variant?: string;
  onClick?(event: MouseEvent, definition: FeatureHintDefinition, action: FeatureHintActionItem): void;
}

interface FeatureHintActionItem {
  id: string;
  icon: RemixIconSpec | null;
  labelKey: string;
  labelFallback: string;
  onClick: FeatureHintAction['onClick'] | null;
  variant: 'primary' | 'secondary';
  order: number;
}

interface FeatureHintDefinition {
  id: string;
  // The version that introduced it; a later version's hint shows again.
  introducedIn?: string;
  surface?: string;
  placement?: string;
  className?: string;
  arrowSide?: string;
  arrowAlign?: string;
  widthMode?: string;
  alignMode?: string;
  dismissStorage?: string;
  // Count the first showing as a dismissal, so it shows only once.
  rememberOnFirstShow?: boolean;
  roundedArrowTip?: boolean;
  inlineActions?: boolean;
  badgeIcon?: RemixIconName;
  badgeIconText?: string;
  badgeIconImageSrc?: string;
  badgeWordmarkImageSrc?: string;
  badgeWordmarkDarkImageSrc?: string;
  badgeKey: string;
  badgeFallback: string;
  textKey: string;
  textFallback: string;
  linkKey?: string;
  linkFallback?: string;
  linkUrl?: string;
  connectorKey?: string;
  connectorFallback?: string;
  trailingKey?: string;
  trailingFallback?: string;
  closeLabelKey: string;
  closeLabelFallback: string;
  actions?: FeatureHintAction[];
}

// The storage the dismissals use, from chrome or a test double.
type FeatureHintChromeApi = SettingsStoreChromeApi;

// The page window, or a stand-in with the members used here.
type FeatureHintWindow = Partial<Pick<Window,
  'getComputedStyle' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'navigator' | 'open' | 'location'>> & {
  ResizeObserver?: typeof ResizeObserver;
};

type Translate = (key: string, fallback: string) => string;

interface FeatureHintOptions {
  // The surface's React root, which draws the hint.
  portals: PortalHost;
  documentObj?: Document | null;
  windowObj?: FeatureHintWindow | null;
  chromeApi?: FeatureHintChromeApi | null;
  // The hint, by definition or by id (or FEATURE_HINTS key).
  definition?: FeatureHintDefinition | string | null;
  id?: string;
  hint?: FeatureHintDefinition | string | null;
  t?: Translate | null;
  arrowSide?: string;
  arrowAlign?: string;
  dismissStorage?: string;
  widthMode?: string;
  alignMode?: string;
  dismissKey?: string;
  syncDismissKey?: string;
  localDismissKey?: string;
  sessionDismissKey?: string;
  rememberOnFirstShow?: boolean;
  roundedArrowTip?: boolean;
  inlineActions?: boolean;
  actions?: FeatureHintAction[];
  onLinkClick?(event: MouseEvent, definition: FeatureHintDefinition): void;
  linkUrl?: string;
  getLinkUrl?(definition: FeatureHintDefinition): string;
  linkTarget?: string;
  linkKey?: string;
  linkFallback?: string;
  connectorKey?: string;
  connectorFallback?: string;
  trailingKey?: string;
  trailingFallback?: string;
  initiallyDismissed?: boolean;
  initiallyVisible?: boolean;
  // The hint stays hidden until this settles.
  visibilityGate?: PromiseLike<unknown> | null;
  badgeIconImageSrc?: string;
  badgeWordmarkImageSrc?: string;
  badgeWordmarkDarkImageSrc?: string;
  elementId?: string;
  textId?: string;
  navigatorLike?: NavigatorLike | null;
  onActionClick?(actionId: string, event: MouseEvent, definition: FeatureHintDefinition): void;
  onDismiss?(definition: FeatureHintDefinition): void;
}

interface FeatureHintController {
  definition: FeatureHintDefinition;
  element: HTMLElement;
  textId: string;
  destroy(): void;
  dismiss(): void;
  isDismissed(): boolean;
  isVisible(): boolean;
  // Whether the hint is showing once its dismissal and visibility gate are known.
  ready: Promise<boolean>;
  setVisible(visible: boolean): void;
  updateLanguage(): void;
}

const FEATURE_HINTS = Object.freeze({
  NEWTAB_WALLPAPER_SOURCES: Object.freeze({
    id: 'newtab-wallpaper-sources',
    introducedIn: '0.9.58',
    surface: 'newtab',
    placement: 'bottom-right wallpaper control',
    className: 'x-lumno-feature-hint--newtab-wallpaper',
    arrowSide: 'right',
    arrowAlign: 'center',
    widthMode: 'content',
    dismissStorage: 'sync',
    rememberOnFirstShow: false,
    roundedArrowTip: true,
    badgeIcon: 'ri-asterisk',
    badgeKey: 'newtab_wallpaper_sources_feature_hint_badge',
    badgeFallback: 'New',
    textKey: 'newtab_wallpaper_sources_feature_hint_text',
    textFallback: 'New wallpapers: curated nature, city and art collections that can update daily, or add one by image link.',
    closeLabelKey: 'newtab_wallpaper_sources_feature_hint_close',
    closeLabelFallback: 'Dismiss new wallpapers tip'
  }),
  NEWTAB_AI_QUICK_JUMP: Object.freeze({
    id: 'newtab-ai-quick-jump',
    introducedIn: '0.9.9',
    surface: 'newtab',
    placement: 'below search input',
    className: 'x-lumno-feature-hint--newtab-ai-quick-jump',
    arrowSide: 'top',
    arrowAlign: 'center',
    widthMode: 'container',
    alignMode: 'auto',
    dismissStorage: 'sync',
    rememberOnFirstShow: true,
    roundedArrowTip: true,
    badgeIcon: 'ri-asterisk',
    badgeKey: 'newtab_ai_quick_jump_feature_hint_badge',
    badgeFallback: 'New',
    textKey: 'newtab_ai_quick_jump_feature_hint_text',
    textFallback: 'Jump to popular AI sites with your prompt in one click. Try typing "gemini" and pressing Tab.',
    linkKey: 'newtab_ai_quick_jump_feature_hint_link',
    linkFallback: 'Support list',
    closeLabelKey: 'newtab_ai_quick_jump_feature_hint_close',
    closeLabelFallback: 'Dismiss AI quick jump tip'
  }),
  NEWTAB_TAB_SWITCHER: Object.freeze({
    id: 'newtab-tab-switcher',
    introducedIn: '0.9.13',
    surface: 'newtab',
    placement: 'newtab settings icon',
    className: 'x-lumno-feature-hint--newtab-tab-switcher',
    arrowSide: 'top',
    arrowAlign: 'end',
    widthMode: 'fixed',
    alignMode: 'auto',
    dismissStorage: 'sync',
    rememberOnFirstShow: true,
    roundedArrowTip: true,
    badgeIcon: 'ri-asterisk',
    badgeKey: 'newtab_tab_switcher_feature_hint_badge',
    badgeFallback: 'New',
    textKey: 'newtab_tab_switcher_feature_hint_text',
    textFallback: 'Press {shortcut} to open the tab switcher and jump through recent tabs without reaching for the mouse.',
    closeLabelKey: 'newtab_tab_switcher_feature_hint_close',
    closeLabelFallback: 'Dismiss tab switcher tip'
  }),
  NEWTAB_WEBDAV_SYNC: Object.freeze({
    id: 'newtab-webdav-sync',
    introducedIn: '0.9.58',
    surface: 'newtab',
    placement: 'above newtab settings button',
    className: 'x-lumno-feature-hint--newtab-webdav-sync',
    arrowSide: 'bottom',
    arrowAlign: 'end',
    widthMode: 'content',
    alignMode: 'auto',
    dismissStorage: 'sync',
    rememberOnFirstShow: false,
    roundedArrowTip: true,
    badgeIcon: 'ri-asterisk',
    badgeKey: 'newtab_webdav_feature_hint_badge',
    badgeFallback: 'Beta',
    textKey: 'newtab_webdav_feature_hint_text',
    textFallback: 'Try WebDAV sync: keep settings, icons and wallpapers in step through a WebDAV drive or NAS, even across browsers.',
    linkKey: 'newtab_webdav_feature_hint_link',
    linkFallback: 'Set up',
    closeLabelKey: 'newtab_webdav_feature_hint_close',
    closeLabelFallback: 'Dismiss WebDAV tip'
  }),
  // New installs and everyone updating to this version see it until they close it or ask a question.
  NEWTAB_HELP_CENTER_ASK: Object.freeze({
    id: 'newtab-help-center-ask',
    introducedIn: '1.0.0',
    surface: 'newtab',
    placement: 'above search input',
    className: 'x-lumno-feature-hint--newtab-help-center-ask',
    arrowSide: 'bottom',
    arrowAlign: 'start',
    widthMode: 'content',
    alignMode: 'auto',
    dismissStorage: 'sync',
    rememberOnFirstShow: false,
    roundedArrowTip: true,
    badgeIcon: 'ri-asterisk',
    badgeKey: 'newtab_help_center_ask_feature_hint_badge',
    badgeFallback: 'New',
    textKey: 'newtab_help_center_ask_feature_hint_text',
    textFallback: 'Not sure how something works? Type lm, press Tab and ask the Help Center.',
    linkKey: 'newtab_help_center_ask_feature_hint_link',
    linkFallback: 'Try it',
    closeLabelKey: 'newtab_help_center_ask_feature_hint_close',
    closeLabelFallback: 'Dismiss Help Center tip'
  })
} satisfies Record<string, FeatureHintDefinition>);

type FeatureHintKey = keyof typeof FEATURE_HINTS;

const FEATURE_HINT_ARROW_SIDES: readonly FeatureHintArrowSide[] = ['top', 'right', 'bottom', 'left'];
const FEATURE_HINT_ARROW_ALIGNS: readonly FeatureHintArrowAlign[] = ['start', 'center', 'end'];
const FEATURE_HINT_DISMISS_STORAGE_TYPES: readonly FeatureHintDismissStorage[] = ['none', 'session', 'local', 'sync'];
const FEATURE_HINT_WIDTH_MODES: readonly FeatureHintWidthMode[] = ['fixed', 'container', 'content'];
const FEATURE_HINT_ALIGN_MODES: readonly FeatureHintAlignMode[] = ['center', 'start', 'auto'];

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isFeatureHintKey(value: string): value is FeatureHintKey {
  return hasOwn(FEATURE_HINTS, value);
}

const FEATURE_HINTS_BY_ID: Readonly<Record<string, FeatureHintDefinition>> = Object.freeze(
  Object.keys(FEATURE_HINTS).filter(isFeatureHintKey).reduce<Record<string, FeatureHintDefinition>>((map, key) => {
    const hint = FEATURE_HINTS[key];
    map[hint.id] = hint;
    return map;
  }, {})
);

function getMessage(t: Translate | null, key: string | undefined, fallback: string | undefined): string {
  return t ? t(key || '', fallback || '') : (fallback || '');
}

function formatShortcutText(text: string, shortcut: string, navigatorLike: NavigatorLike | null): string {
  return LumnoShortcutDisplay.formatShortcutTemplate(text, shortcut, { navigatorLike });
}

function getDomIdPart(id: string | undefined): string {
  return String(id || 'feature-hint').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'feature_hint';
}

function normalizeFeatureHintValue<T extends string>(value: unknown, allowedValues: readonly T[], fallback: T): T {
  const normalized = String(value || '').toLowerCase();
  return allowedValues.find((allowed) => allowed === normalized) || fallback;
}

function normalizeArrowSide(value: unknown): FeatureHintArrowSide {
  return normalizeFeatureHintValue(value, FEATURE_HINT_ARROW_SIDES, 'bottom');
}

function normalizeArrowAlign(value: unknown): FeatureHintArrowAlign {
  return normalizeFeatureHintValue(value, FEATURE_HINT_ARROW_ALIGNS, 'center');
}

function normalizeDismissStorage(value: unknown): FeatureHintDismissStorage {
  return normalizeFeatureHintValue(value, FEATURE_HINT_DISMISS_STORAGE_TYPES, 'none');
}

function normalizeWidthMode(value: unknown): FeatureHintWidthMode {
  return normalizeFeatureHintValue(value, FEATURE_HINT_WIDTH_MODES, 'fixed');
}

function normalizeAlignMode(value: unknown): FeatureHintAlignMode {
  return normalizeFeatureHintValue(value, FEATURE_HINT_ALIGN_MODES, 'center');
}

type FeatureHintReference = FeatureHintDefinition | string | null | undefined;

function getFeatureHint(definition: FeatureHintReference): FeatureHintDefinition | null {
  if (!definition) {
    return null;
  }
  if (typeof definition === 'string') {
    if (hasOwn(FEATURE_HINTS_BY_ID, definition)) {
      return FEATURE_HINTS_BY_ID[definition];
    }
    return isFeatureHintKey(definition) ? FEATURE_HINTS[definition] : null;
  }
  return definition;
}

function listFeatureHints(): FeatureHintDefinition[] {
  return Object.keys(FEATURE_HINTS).filter(isFeatureHintKey).map((key) => FEATURE_HINTS[key]);
}

export {
  FEATURE_HINTS,
  FEATURE_HINTS_BY_ID,
  FEATURE_HINT_ALIGN_MODES,
  FEATURE_HINT_ARROW_ALIGNS,
  FEATURE_HINT_ARROW_SIDES,
  FEATURE_HINT_DISMISS_STORAGE_TYPES,
  FEATURE_HINT_WIDTH_MODES,
  formatShortcutText,
  getDomIdPart,
  getFeatureHint,
  getMessage,
  hasOwn,
  isFeatureHintKey,
  listFeatureHints,
  normalizeAlignMode,
  normalizeArrowAlign,
  normalizeArrowSide,
  normalizeDismissStorage,
  normalizeFeatureHintValue,
  normalizeWidthMode
};
export type {
  FeatureHintAction,
  FeatureHintActionItem,
  FeatureHintAlignMode,
  FeatureHintArrowAlign,
  FeatureHintArrowSide,
  FeatureHintChromeApi,
  FeatureHintController,
  FeatureHintDefinition,
  FeatureHintDismissStorage,
  FeatureHintKey,
  FeatureHintOptions,
  FeatureHintReference,
  FeatureHintWidthMode,
  FeatureHintWindow,
  Translate
};
