// The controller that shows one feature hint through the React feature hint
// view (react/feature-hint-view.tsx): its visibility, dismissal, labels and
// alignment.
import type { FeatureHintViewController, FeatureHintViewLabels, FeatureHintViewModel } from '../../types/view-apis';
import { createFeatureHintAlignment, destroyAlignment, disconnectAlignmentObserver, scheduleContentAlignmentUpdate } from './feature-hint-alignment';
import type { FeatureHintAlignment } from './feature-hint-alignment';
import type { NavigatorLike } from '../../domain/shortcut-display';
import { createFeatureHintView } from '../react/feature-hint-view';
import { createViewStore } from '../react/view-store';
import type { Store } from '../state/store';
import { formatShortcutText, getDomIdPart, getFeatureHint, getMessage, normalizeAlignMode, normalizeArrowAlign, normalizeArrowSide, normalizeDismissStorage, normalizeWidthMode } from './feature-hint-catalog';
import type {
  FeatureHintActionItem,
  FeatureHintAlignMode,
  FeatureHintArrowAlign,
  FeatureHintArrowSide,
  FeatureHintChromeApi,
  FeatureHintController,
  FeatureHintDefinition,
  FeatureHintDismissStorage,
  FeatureHintOptions,
  FeatureHintWidthMode,
  FeatureHintWindow,
  Translate
} from './feature-hint-catalog';
import { getFeatureHintLocalDismissKey, getFeatureHintSessionDismissKey, getFeatureHintSyncDismissKey, getStoredDismissed, setStoredDismissed } from './feature-hint-dismiss';

// HTML, SVG and MathML elements have blur(); other elements do not.
function isBlurrable(element: Element): element is Element & HTMLOrSVGElement {
  return 'blur' in element && typeof element.blur === 'function';
}

// Whether a hint shows: asked to, not dismissed, and both its stored
// dismissal and its visibility gate known. `ready` settles once both are.
class HintVisibility {
  requested: boolean;
  dismissed: boolean;
  dismissLoaded: boolean;
  gateSettled = true;
  destroyed = false;
  // A hint remembered on first show is remembered once.
  firstShowRemembered = false;
  readonly ready: Promise<boolean>;
  private settled = false;
  private resolveReady: ((visible: boolean) => void) | null = null;

  constructor(requested: boolean, dismissed: boolean, dismissLoaded: boolean) {
    this.requested = requested;
    this.dismissed = dismissed;
    this.dismissLoaded = dismissLoaded;
    this.ready = new Promise<boolean>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  shows(): boolean {
    return this.requested && !this.dismissed && this.dismissLoaded && this.gateSettled;
  }

  // Resolves `ready` with whether the hint shows, once both are known
  // (or at once when forced).
  settle(visible: boolean, force?: boolean): void {
    if (this.settled || (!force && (!this.dismissLoaded || !this.gateSettled))) {
      return;
    }
    this.settled = true;
    if (this.resolveReady) {
      this.resolveReady(visible);
    }
  }
}

// One hint on one page, from its view's creation to destroy(): what its
// options and definition settled, its view, and whether it shows.
type FeatureHintLabelsStore = Store<{ labels: FeatureHintViewLabels }>;

interface FeatureHintContext {
  readonly settings: FeatureHintSettings;
  readonly view: FeatureHintViewController;
  // The copy the view shows, set in the page's language.
  readonly labels: FeatureHintLabelsStore;
  readonly element: HTMLSpanElement;
  readonly alignment: FeatureHintAlignment;
  readonly visibility: HintVisibility;
}

// What the options and the definition settle, once the view is made.
interface FeatureHintSettings {
  readonly config: FeatureHintOptions;
  readonly hint: FeatureHintDefinition;
  readonly page: Document;
  readonly t: Translate | null;
  readonly windowObj: FeatureHintWindow | null;
  readonly chromeApi: FeatureHintChromeApi | null;
  readonly dismissStorage: FeatureHintDismissStorage;
  readonly dismissKey: string;
  readonly rememberOnFirstShow: boolean;
  readonly hasLink: boolean;
  readonly actions: FeatureHintActionItem[];
}

// What the options and the definition settle before the view is made.
interface FeatureHintSetup {
  config: FeatureHintOptions;
  hint: FeatureHintDefinition;
  page: Document;
  arrowSide: FeatureHintArrowSide;
  arrowAlign: FeatureHintArrowAlign;
  dismissStorage: FeatureHintDismissStorage;
  widthMode: FeatureHintWidthMode;
  alignMode: FeatureHintAlignMode;
  hasLink: boolean;
  actions: FeatureHintActionItem[];
}

function chooseDismissKey(config: FeatureHintOptions, hint: FeatureHintDefinition, storage: FeatureHintDismissStorage): string {
  if (config.dismissKey) {
    return config.dismissKey;
  }
  if (storage === 'sync') {
    return config.syncDismissKey || getFeatureHintSyncDismissKey(hint);
  }
  if (storage === 'local') {
    return config.localDismissKey || getFeatureHintLocalDismissKey(hint);
  }
  return config.sessionDismissKey || getFeatureHintSessionDismissKey(hint);
}

function readBooleanOption(value: boolean | undefined, fallback: boolean | undefined): boolean {
  return typeof value === 'boolean' ? value : Boolean(fallback);
}

// The actions in order, the first of each id kept.
function readActions(config: FeatureHintOptions, hint: FeatureHintDefinition): FeatureHintActionItem[] {
  const configuredActions = Array.isArray(config.actions)
    ? config.actions
    : (Array.isArray(hint.actions) ? hint.actions : []);
  return configuredActions.reduce<FeatureHintActionItem[]>((items, action, index) => {
    const id = String(action && (action.id || action.actionId) || '').trim();
    if (!id || items.some((item) => item.id === id)) {
      return items;
    }
    items.push({
      id,
      icon: action.icon ? { name: action.icon, size: 12 } : null,
      labelKey: String(action.labelKey || '').trim(),
      labelFallback: String(action.labelFallback || '').trim(),
      onClick: typeof action.onClick === 'function' ? action.onClick : null,
      variant: action.variant === 'primary' ? 'primary' : 'secondary',
      order: index
    });
    return items;
  }, []);
}

function readSetup(config: FeatureHintOptions, hint: FeatureHintDefinition, page: Document): FeatureHintSetup {
  return {
    config,
    hint,
    page,
    arrowSide: normalizeArrowSide(config.arrowSide || hint.arrowSide),
    arrowAlign: normalizeArrowAlign(config.arrowAlign || hint.arrowAlign),
    dismissStorage: normalizeDismissStorage(config.dismissStorage || hint.dismissStorage),
    widthMode: normalizeWidthMode(config.widthMode || hint.widthMode),
    alignMode: normalizeAlignMode(config.alignMode || hint.alignMode),
    hasLink: Boolean(config.onLinkClick || config.linkUrl || hint.linkKey || hint.linkFallback),
    actions: readActions(config, hint)
  };
}

function activateLink(config: FeatureHintOptions, hint: FeatureHintDefinition, event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (typeof config.onLinkClick === 'function') {
    config.onLinkClick(event, hint);
    return;
  }
  const linkUrl = typeof config.getLinkUrl === 'function'
    ? config.getLinkUrl(hint)
    : (config.linkUrl || hint.linkUrl || '');
  const targetWindow: FeatureHintWindow | null = config.windowObj || (typeof window !== 'undefined' ? window : null);
  if (!linkUrl || !targetWindow) {
    return;
  }
  if (config.linkTarget === '_blank' && typeof targetWindow.open === 'function') {
    targetWindow.open(linkUrl, '_blank', 'noopener');
    return;
  }
  if (targetWindow.location) {
    targetWindow.location.assign(linkUrl);
  }
}

function readBadgeImages(
  config: FeatureHintOptions,
  hint: FeatureHintDefinition
): Pick<FeatureHintViewModel, 'badgeIconImageSrc' | 'badgeWordmarkDarkImageSrc' | 'badgeWordmarkImageSrc'> {
  return {
    badgeIconImageSrc: String(config.badgeIconImageSrc || hint.badgeIconImageSrc || ''),
    badgeWordmarkDarkImageSrc: String(config.badgeWordmarkDarkImageSrc || hint.badgeWordmarkDarkImageSrc || ''),
    badgeWordmarkImageSrc: String(config.badgeWordmarkImageSrc || hint.badgeWordmarkImageSrc || '')
  };
}

function buildViewModel(setup: FeatureHintSetup): FeatureHintViewModel {
  const { config, hint } = setup;
  const idPart = getDomIdPart(hint.id);
  return {
    actions: setup.actions.map((action) => ({
      icon: action.icon || undefined,
      id: action.id,
      variant: action.variant
    })),
    alignMode: setup.alignMode,
    arrowAlign: setup.arrowAlign,
    arrowSide: setup.arrowSide,
    badgeIcon: hint.badgeIcon ? { name: hint.badgeIcon } : undefined,
    ...readBadgeImages(config, hint),
    badgeIconText: String(hint.badgeIconText || '').trim(),
    className: hint.className || '',
    dismissStorage: setup.dismissStorage,
    elementId: config.elementId || `_x_lumno_feature_hint_${idPart}_2026_unique_`,
    hasLink: setup.hasLink,
    hintId: hint.id,
    inlineActions: Boolean(config.inlineActions || hint.inlineActions),
    placement: hint.placement || '',
    roundedArrowTip: readBooleanOption(config.roundedArrowTip, hint.roundedArrowTip),
    surface: hint.surface || '',
    textId: config.textId || `_x_lumno_feature_hint_${idPart}_text_2026_unique_`,
    version: hint.introducedIn || '',
    widthMode: setup.widthMode
  };
}

function createHintView(setup: FeatureHintSetup, labels: FeatureHintLabelsStore, onDismiss: () => void): FeatureHintViewController | null {
  const { config, hint, actions } = setup;
  return createFeatureHintView({
    portals: config.portals,
    documentObj: setup.page,
    model: buildViewModel(setup),
    labels,
    onDismiss,
    onActionClick(actionId, event) {
      const action = actions.find((item) => item.id === actionId);
      if (action && action.onClick) {
        action.onClick(event, hint, action);
      }
      if (typeof config.onActionClick === 'function') {
        config.onActionClick(actionId, event, hint);
      }
    },
    onLinkClick: (event) => activateLink(config, hint, event)
  });
}

function setElementInert(element: HTMLElement, inert: boolean): void {
  try {
    if ('inert' in element) {
      element.inert = inert;
    }
  } catch (_error) {
    // Some DOM test doubles expose readonly properties; inert is only a progressive enhancement.
  }
}

function blurFocusedChildIfNeeded(ctx: FeatureHintContext): void {
  const activeElement = ctx.settings.page.activeElement;
  if (!activeElement || !isBlurrable(activeElement)) {
    return;
  }
  if (activeElement === ctx.element || ctx.element.contains(activeElement)) {
    activeElement.blur();
  }
}

function syncVisibility(ctx: FeatureHintContext): void {
  const element = ctx.element;
  const nextVisible = ctx.visibility.shows();
  element.setAttribute('data-visible', nextVisible ? 'true' : 'false');
  element.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
  setElementInert(element, !nextVisible);
  if (nextVisible) {
    if (ctx.settings.rememberOnFirstShow && !ctx.visibility.firstShowRemembered && ctx.settings.dismissStorage !== 'none') {
      ctx.visibility.firstShowRemembered = true;
      setStoredDismissed(ctx.settings.chromeApi, ctx.settings.dismissKey);
    }
    scheduleContentAlignmentUpdate(ctx.alignment);
  } else {
    blurFocusedChildIfNeeded(ctx);
    if (ctx.visibility.dismissed) {
      disconnectAlignmentObserver(ctx.alignment);
    }
  }
}

function settleReady(ctx: FeatureHintContext, force?: boolean): void {
  ctx.visibility.settle(ctx.element.getAttribute('data-visible') === 'true', force);
}

function destroyHint(ctx: FeatureHintContext): void {
  if (ctx.visibility.destroyed) {
    return;
  }
  ctx.visibility.destroyed = true;
  settleReady(ctx, true);
  destroyAlignment(ctx.alignment);
  ctx.view.destroy();
}

function dismissHint(ctx: FeatureHintContext): void {
  if (ctx.visibility.destroyed || ctx.visibility.dismissed) {
    return;
  }
  ctx.visibility.dismissed = true;
  ctx.element.setAttribute('data-dismissed', 'true');
  if (ctx.settings.dismissStorage !== 'none') {
    setStoredDismissed(ctx.settings.chromeApi, ctx.settings.dismissKey);
  }
  syncVisibility(ctx);
  if (typeof ctx.settings.config.onDismiss === 'function') {
    ctx.settings.config.onDismiss(ctx.settings.hint);
  }
}

// A label from the options or the definition; empty when neither names one.
function readOptionalLabel(t: Translate | null, key: string, fallback: string): string {
  return key || fallback ? getMessage(t, key, fallback) : '';
}

function readNavigator(ctx: FeatureHintContext): NavigatorLike | null {
  return ctx.settings.config.navigatorLike || (ctx.settings.windowObj && ctx.settings.windowObj.navigator) || globalThis.navigator || null;
}

function readLabels(ctx: FeatureHintContext): FeatureHintViewLabels {
  const { config, hint, t } = ctx.settings;
  const actionLabels: Record<string, string> = {};
  ctx.settings.actions.forEach((action) => {
    actionLabels[action.id] = getMessage(t, action.labelKey, action.labelFallback);
  });
  return {
    actions: actionLabels,
    badge: getMessage(t, hint.badgeKey, hint.badgeFallback),
    close: getMessage(t, hint.closeLabelKey, hint.closeLabelFallback),
    connector: readOptionalLabel(t, config.connectorKey || hint.connectorKey || '',
      config.connectorFallback || hint.connectorFallback || ''),
    link: ctx.settings.hasLink
      ? getMessage(t, config.linkKey || hint.linkKey, config.linkFallback || hint.linkFallback)
      : '',
    text: formatShortcutText(getMessage(t, hint.textKey, hint.textFallback), 'Alt+Q', readNavigator(ctx)),
    trailing: readOptionalLabel(t, config.trailingKey || hint.trailingKey || '',
      config.trailingFallback || hint.trailingFallback || '')
  };
}

function updateHintLanguage(ctx: FeatureHintContext): void {
  if (ctx.visibility.destroyed) {
    return;
  }
  ctx.labels.setState({ labels: readLabels(ctx) });
  scheduleContentAlignmentUpdate(ctx.alignment);
}

function waitForVisibilityGate(ctx: FeatureHintContext, visibilityGate: PromiseLike<unknown>): void {
  const releaseVisibilityGate = (): void => {
    if (ctx.visibility.destroyed || ctx.visibility.gateSettled) {
      return;
    }
    ctx.visibility.gateSettled = true;
    syncVisibility(ctx);
    settleReady(ctx);
  };
  visibilityGate.then(releaseVisibilityGate, releaseVisibilityGate);
}

function loadDismissState(ctx: FeatureHintContext): void {
  if (ctx.settings.dismissStorage === 'none') {
    settleReady(ctx);
    return;
  }
  getStoredDismissed(ctx.settings.chromeApi, ctx.settings.dismissKey).then((isDismissed) => {
    if (ctx.visibility.destroyed) {
      return;
    }
    ctx.visibility.dismissLoaded = true;
    if (isDismissed && !ctx.visibility.dismissed) {
      ctx.visibility.dismissed = true;
      ctx.element.setAttribute('data-dismissed', 'true');
    }
    syncVisibility(ctx);
    settleReady(ctx);
  });
}

function createFeatureHintContext(setup: FeatureHintSetup, view: FeatureHintViewController, labels: FeatureHintLabelsStore): FeatureHintContext {
  const { config, hint, page, dismissStorage } = setup;
  const windowObj: FeatureHintWindow | null = config.windowObj || page.defaultView ||
    (typeof window !== 'undefined' ? window : null);
  return {
    settings: {
      config,
      hint,
      page,
      t: typeof config.t === 'function' ? config.t : null,
      windowObj,
      chromeApi: config.chromeApi || (typeof chrome !== 'undefined' ? chrome : null),
      dismissStorage,
      dismissKey: chooseDismissKey(config, hint, dismissStorage),
      rememberOnFirstShow: readBooleanOption(config.rememberOnFirstShow, hint.rememberOnFirstShow),
      hasLink: setup.hasLink,
      actions: setup.actions
    },
    view,
    labels,
    element: view.element,
    alignment: createFeatureHintAlignment(setup.alignMode, windowObj, view, setup.hasLink),
    visibility: new HintVisibility(config.initiallyVisible !== false, Boolean(config.initiallyDismissed), dismissStorage === 'none')
  };
}

function createFeatureHint(options: FeatureHintOptions): FeatureHintController | null {
  const config = options;
  const documentObj = config.documentObj || (typeof document !== 'undefined' ? document : null);
  const definition = getFeatureHint(config.definition || config.id || config.hint);
  if (!definition || !documentObj) {
    return null;
  }
  const setup = readSetup(config, definition, documentObj);
  let controller: FeatureHintController | null = null;
  const labels = createViewStore<{ labels: FeatureHintViewLabels }>({
    labels: { actions: {}, badge: '', close: '', connector: '', link: '', text: '', trailing: '' }
  });
  const view = createHintView(setup, labels, () => {
    if (controller) {
      controller.dismiss();
    }
  });
  if (!view) {
    return null;
  }
  const ctx = createFeatureHintContext(setup, view, labels);
  const visibilityGate = config.visibilityGate && typeof config.visibilityGate.then === 'function'
    ? config.visibilityGate
    : null;
  ctx.visibility.gateSettled = !visibilityGate;
  ctx.element.setAttribute('data-dismissed', ctx.visibility.dismissed ? 'true' : 'false');

  const hintController: FeatureHintController = {
    definition,
    element: ctx.element,
    textId: view.text.id,
    destroy: () => destroyHint(ctx),
    dismiss: () => dismissHint(ctx),
    isDismissed: () => ctx.visibility.dismissed,
    isVisible: () => ctx.element.getAttribute('data-visible') === 'true',
    ready: ctx.visibility.ready,
    setVisible(visible: boolean) {
      if (ctx.visibility.destroyed) {
        return;
      }
      ctx.visibility.requested = Boolean(visible);
      syncVisibility(ctx);
    },
    updateLanguage: () => updateHintLanguage(ctx)
  };
  controller = hintController;

  hintController.updateLanguage();
  syncVisibility(ctx);
  if (visibilityGate) {
    waitForVisibilityGate(ctx, visibilityGate);
  }
  loadDismissState(ctx);
  return hintController;
}

export {
  createFeatureHint,
  isBlurrable
};
