import { useRef, type RefObject } from 'react';
import { queryHtmlElement, queryHtmlTag, querySvgElement } from '../dom-lookup';
import { createViewStore } from './view-store';
import { useStore } from './use-store';
import type { Store } from '../state/store';
import { ModeMenu, createModeMenuStore, type ModeMenuStore } from './search/mode-menu';
import {
  ModeTag,
  TabHint,
  createModeTagStore,
  createTabHintStore,
  type ModeTagStore,
  type TabHintStore
} from './search/mode-tag';
import { ClearAction, RightIcon, ScopeIcon } from './search-input-parts/buttons';
import type { ClearActionConfig, SearchScopeAction } from './search-input-parts/buttons';
import { CLASSES, noTranslateProps } from './search-input-parts/chrome';
import type { SearchInputTooltip } from './search-input-parts/chrome';
import { SecondaryAction } from './search-input-parts/secondary-action';
import type { SecondaryActionConfig } from './search-input-parts/secondary-action';
import { applyStyles, ensureStyles } from './search-input-parts/styles';
import type { PortalHost } from './portal-host';

type StyleOverrides = Record<string, string>;

// What the surface changes about the field's chrome after creating it.
export interface SearchInputChrome {
  // The buttons' names and tooltips, in the current language.
  rightIconLabel: string;
  clearLabel: string;
  secondaryLabel: string;
  scopeAction: SearchScopeAction | null;
  // The underline, when the surface decides it (the overlay shows it with
  // its results); null leaves it to the field's text.
  underline: boolean | null;
  tooltip: SearchInputTooltip | null;
  // The mode badge at the field's end (a slash command's current mode);
  // its text stays while it fades out.
  badgeVisible: boolean;
  badgeText: string;
}

export interface SearchInputConfig {
  // The page's React root, which draws the input into its container.
  portals: PortalHost;
  // An empty element the surface's own view drew for the input; a new one
  // otherwise.
  container?: HTMLDivElement;
  clearAction?: ClearActionConfig;
  containerId?: string;
  containerStyleOverrides?: StyleOverrides;
  dividerId?: string;
  dividerStyleOverrides?: StyleOverrides;
  iconId?: string;
  iconStyleOverrides?: StyleOverrides;
  inputId?: string;
  inputStyleOverrides?: StyleOverrides;
  modeBadge?: {
    className?: string;
    id?: string;
    surface?: string;
    visible?: boolean;
  };
  onBlur?(event: FocusEvent): void;
  onFocus?(event: FocusEvent): void;
  onInput?(event: Event): void;
  onKeyDown?(event: KeyboardEvent): void;
  placeholder?: string;
  rightIconAlt?: string;
  rightIconId?: string;
  rightIconStyleOverrides?: StyleOverrides;
  secondaryAction?: SecondaryActionConfig;
  showRightIcon?: boolean;
  showUnderlineWhenEmpty?: boolean;
  // The shadow root the input draws in; its styles go there. Without one the
  // page's own stylesheet styles it.
  styleRoot?: Document | ShadowRoot | null;
}

export interface SearchInputParts {
  clearAction: HTMLButtonElement | null;
  container: HTMLDivElement;
  portals: PortalHost;
  divider: HTMLDivElement;
  icon: HTMLDivElement;
  input: HTMLInputElement;
  modeBadge: HTMLDivElement | null;
  modeMenu: HTMLDivElement;
  modeMenuContent: HTMLDivElement;
  modeMenuFooter: HTMLDivElement;
  // What the input mode controller sets for the mode menu, tag and hint.
  modeMenuStore: ModeMenuStore;
  modeTagStore: ModeTagStore;
  tabHintStore: TabHintStore;
  modePrefix: HTMLButtonElement;
  modePrefixChevron: HTMLElement;
  modePrefixCurrent: HTMLSpanElement;
  modePrefixGlyph: HTMLElement;
  modePrefixIconFrame: HTMLSpanElement;
  modePrefixIcon: HTMLImageElement;
  modePrefixLineIcon: SVGElement;
  modePrefixText: HTMLSpanElement;
  modeTabHint: HTMLSpanElement;
  modeTabHintKey: HTMLSpanElement;
  modeTabHintText: HTMLSpanElement;
  rightIcon: HTMLButtonElement;
  secondaryAction: HTMLButtonElement | null;
  // The labels, buttons and badge around the field, as the surface sets them.
  chrome: Store<SearchInputChrome>;
  syncClearAction(): boolean;
}

// The root each input was drawn through, to take it out again.
const hosts = new WeakMap<HTMLElement, PortalHost>();

// The stores the input mode controller draws the mode tag, Tab hint and
// scope panel through, and the field's text as the chrome around it last
// saw it.
interface InputStores {
  modeMenu: ModeMenuStore;
  modeTag: ModeTagStore;
  tabHint: TabHintStore;
  value: Store<{ text: string }>;
  chrome: Store<SearchInputChrome>;
}

// The ids of the mode tag and Tab hint, which differ between the surfaces.
const MODE_IDS = {
  overlay: { prefix: '_x_extension_site_search_prefix_2024_unique_', tabHint: '_x_extension_site_search_tab_hint_2026_unique_' },
  newtab: { prefix: '_x_extension_newtab_site_search_prefix_2024_unique_', tabHint: '_x_extension_newtab_site_search_tab_hint_2026_unique_' }
} as const;

// The underline shows with text, or always when the surface says so; an
// input border set by the surface replaces it.
function isDividerVisible(config: SearchInputConfig, chrome: SearchInputChrome, value: string): boolean {
  const hasBorderOverride = Boolean(
    config.inputStyleOverrides && Object.prototype.hasOwnProperty.call(config.inputStyleOverrides, 'border-bottom')
  );
  if (hasBorderOverride) {
    return false;
  }
  return chrome.underline === null ? Boolean(config.showUnderlineWhenEmpty) || Boolean(value.trim()) : chrome.underline;
}

function ModeBadge({ badge, chrome }: { badge: NonNullable<SearchInputConfig['modeBadge']>; chrome: SearchInputChrome }) {
  return (
    <div
      className={badge.className || 'x-lumno-search-input-mode__badge'}
      data-surface={badge.surface || 'shared'}
      data-visible={chrome.badgeVisible ? 'true' : 'false'}
      id={badge.id}
    >
      {chrome.badgeText}
    </div>
  );
}

// The buttons at the field's end.
function TrailingActions({ config, chrome, value, inputRef }: {
  config: SearchInputConfig;
  chrome: SearchInputChrome;
  value: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      {config.showRightIcon === false ? null : (
        <RightIcon id={config.rightIconId || '_x_extension_search_right_icon_2024_unique_'} label={chrome.rightIconLabel} tooltip={chrome.tooltip} />
      )}
      {config.clearAction ? (
        <ClearAction action={config.clearAction} inputRef={inputRef} label={chrome.clearLabel} tooltip={chrome.tooltip} visible={value !== ''} />
      ) : null}
      {config.secondaryAction ? (
        <SecondaryAction action={config.secondaryAction} label={chrome.secondaryLabel} tooltip={chrome.tooltip} />
      ) : null}
      {config.modeBadge ? <ModeBadge badge={config.modeBadge} chrome={chrome} /> : null}
    </>
  );
}

function SearchInput({ config, stores }: { config: SearchInputConfig; stores: InputStores }) {
  const value = useStore(stores.value).text;
  const chrome = useStore(stores.chrome);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeSurface = config.modeBadge?.surface === 'overlay' ? 'overlay' : 'newtab';
  const modeIds = MODE_IDS[modeSurface];
  return (
    <>
      <ScopeIcon action={chrome.scopeAction} id={config.iconId || '_x_extension_search_icon_2024_unique_'} tooltip={chrome.tooltip} />
      <input
        {...noTranslateProps()}
        autoComplete="off"
        className={CLASSES.input}
        id={config.inputId || '_x_extension_search_input_2024_unique_'}
        onInput={(event) => stores.value.setState({ text: event.currentTarget.value })}
        placeholder={config.placeholder || 'Search or enter URL…'}
        ref={inputRef}
        type="text"
      />
      <ModeTag prefixId={modeIds.prefix} store={stores.modeTag} />
      <ModeMenu prefixId={modeIds.prefix} store={stores.modeMenu} surface={modeSurface} />
      <TabHint id={modeIds.tabHint} store={stores.tabHint} surface={modeSurface} />
      <div
        {...noTranslateProps()}
        className={CLASSES.divider}
        data-visible={isDividerVisible(config, chrome, value) ? 'true' : 'false'}
        id={config.dividerId || '_x_extension_input_divider_2024_unique_'}
      />
      <TrailingActions chrome={chrome} config={config} inputRef={inputRef} value={value} />
    </>
  );
}

// The mode tag's, Tab hint's and scope panel's elements the input mode
// controller measures and animates; null when one is missing.
function queryModeParts(container: HTMLElement) {
  const parts = {
    modePrefix: queryHtmlTag(container, '[data-search-input-mode-prefix]', 'button'),
    modePrefixGlyph: queryHtmlElement(container, '[data-search-input-mode-prefix-glyph]'),
    modePrefixLineIcon: querySvgElement(container, '[data-search-input-mode-line-icon]'),
    modePrefixIcon: queryHtmlTag(container, '[data-search-input-mode-prefix-icon]', 'img'),
    modePrefixIconFrame: queryHtmlTag(container, '[data-search-input-mode-prefix-icon-frame]', 'span'),
    modePrefixText: queryHtmlTag(container, '[data-search-input-mode-prefix-text]', 'span'),
    modeTabHint: queryHtmlTag(container, '[data-search-input-mode-tab-hint]', 'span'),
    modeTabHintKey: queryHtmlTag(container, '[data-search-input-mode-tab-key]', 'span'),
    modeTabHintText: queryHtmlTag(container, '[data-search-input-mode-tab-text]', 'span'),
    modePrefixChevron: queryHtmlElement(container, '[data-search-input-mode-prefix-chevron]'),
    modePrefixCurrent: queryHtmlTag(container, '[data-search-input-mode-current]', 'span'),
    modeMenu: queryHtmlTag(container, '[data-search-input-mode-menu]', 'div'),
    modeMenuContent: queryHtmlTag(container, '[data-search-input-mode-menu-content]', 'div'),
    modeMenuFooter: queryHtmlTag(container, '[data-search-input-mode-menu-footer]', 'div')
  };
  const {
    modePrefix, modePrefixGlyph, modePrefixLineIcon, modePrefixIcon, modePrefixIconFrame, modePrefixText, modeTabHint,
    modeTabHintKey, modeTabHintText, modePrefixChevron, modePrefixCurrent, modeMenu, modeMenuContent, modeMenuFooter
  } = parts;
  if (!modePrefix || !modePrefixGlyph || !modePrefixLineIcon || !modePrefixIcon || !modePrefixIconFrame || !modePrefixText ||
    !modeTabHint || !modeTabHintKey || !modeTabHintText || !modePrefixChevron || !modePrefixCurrent || !modeMenu ||
    !modeMenuContent || !modeMenuFooter) {
    return null;
  }
  return {
    modePrefix, modePrefixGlyph, modePrefixLineIcon, modePrefixIcon, modePrefixIconFrame, modePrefixText, modeTabHint,
    modeTabHintKey, modeTabHintText, modePrefixChevron, modePrefixCurrent, modeMenu, modeMenuContent, modeMenuFooter
  };
}

// The field's own elements; null when the field did not mount.
function queryFieldParts(container: HTMLElement, config: SearchInputConfig) {
  const input = queryHtmlTag(container, 'input', 'input');
  const icon = queryHtmlTag(container, '.x-lumno-search-input__icon', 'div');
  const divider = queryHtmlTag(container, '.x-lumno-search-input__divider', 'div');
  if (!input || !icon || !divider) {
    return null;
  }
  return {
    input,
    icon,
    divider,
    rightIcon: queryHtmlTag(container, '.x-lumno-search-input__right-icon', 'button') || document.createElement('button'),
    modeBadge: config.modeBadge
      ? queryHtmlTag(container, `#${config.modeBadge.id}`, 'div')
      : queryHtmlTag(container, '.x-lumno-search-input-mode__badge', 'div'),
    secondaryAction: config.secondaryAction ? queryHtmlTag(container, `#${config.secondaryAction.id}`, 'button') : null,
    clearAction: config.clearAction ? queryHtmlTag(container, `#${config.clearAction.id}`, 'button') : null
  };
}

function createStores(config: SearchInputConfig): InputStores {
  return {
    modeMenu: createModeMenuStore(),
    modeTag: createModeTagStore(),
    tabHint: createTabHintStore(),
    value: createViewStore({ text: '' }),
    chrome: createViewStore<SearchInputChrome>({
      rightIconLabel: config.rightIconAlt || 'Settings',
      clearLabel: config.clearAction?.ariaLabel || 'Clear',
      secondaryLabel: config.secondaryAction?.ariaLabel || '',
      scopeAction: null,
      underline: null,
      tooltip: null,
      badgeVisible: Boolean(config.modeBadge && config.modeBadge.visible),
      badgeText: ''
    })
  };
}

function prepareContainer(config: SearchInputConfig): HTMLDivElement {
  const container = config.container || document.createElement('div');
  container.id = config.containerId || '_x_extension_input_container_2024_unique_';
  container.className = CLASSES.container;
  container.dataset.noTranslate = 'true';
  container.dataset.reactIsland = 'shared-search-input';
  container.lang = 'zxx';
  container.setAttribute('notranslate', '');
  container.setAttribute('translate', 'no');
  return container;
}

// The surface's own looks for the parts, set once, and its listeners on
// the field.
function applySurfaceConfig(config: SearchInputConfig, field: NonNullable<ReturnType<typeof queryFieldParts>>,
  container: HTMLElement): void {
  const overrides: Array<[HTMLElement | null, StyleOverrides | undefined]> = [
    [container, config.containerStyleOverrides],
    [field.input, config.inputStyleOverrides],
    [field.divider, config.dividerStyleOverrides],
    [field.icon, config.iconStyleOverrides],
    [field.rightIcon, config.rightIconStyleOverrides],
    [field.clearAction, config.clearAction ? config.clearAction.styleOverrides : undefined]
  ];
  overrides.forEach(([element, styles]) => {
    if (element && styles) {
      applyStyles(element, styles);
    }
  });
  const { input } = field;
  if (config.onInput) {
    input.addEventListener('input', config.onInput);
  }
  if (config.onFocus) {
    input.addEventListener('focus', config.onFocus);
  }
  if (config.onBlur) {
    input.addEventListener('blur', config.onBlur);
  }
  if (config.onKeyDown) {
    input.addEventListener('keydown', config.onKeyDown);
  }
}

export function createSearchInput(config: SearchInputConfig): SearchInputParts {
  ensureStyles(config.styleRoot);
  const container = prepareContainer(config);
  const { portals } = config;
  hosts.set(container, portals);
  const stores = createStores(config);
  portals.show(container, <SearchInput config={config} stores={stores} />);
  const field = queryFieldParts(container, config);
  if (!field) {
    portals.remove(container);
    throw new Error('Search input mount');
  }
  const mode = queryModeParts(container);
  if (!mode) {
    portals.remove(container);
    throw new Error('Search mode mount');
  }
  const { input, clearAction } = field;
  applySurfaceConfig(config, field, container);
  return {
    ...field,
    ...mode,
    container,
    portals,
    modeMenuStore: stores.modeMenu,
    modeTagStore: stores.modeTag,
    tabHintStore: stores.tabHint,
    chrome: stores.chrome,
    // Brings the chrome up to date after the surface set the field's text
    // itself; returns whether the clear button shows.
    syncClearAction() {
      if (input.value !== stores.value.getSnapshot().text) {
        stores.value.setState({ text: input.value });
      }
      return Boolean(clearAction) && input.value !== '';
    }
  };
}

export function destroySearchInput(
  target: SearchInputParts | HTMLElement | null
) {
  const container =
    target && 'container' in target ? target.container : target;
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const portals = hosts.get(container);
  if (!portals) {
    return;
  }
  portals.remove(container);
  hosts.delete(container);
}
