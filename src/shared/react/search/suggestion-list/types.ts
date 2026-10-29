// Types the suggestion list shares between its rows, its runtime and the
// New Tab and overlay adapters that create it.
import type { RemixIconName } from '../../../ui/remix-icon';
import type { Store } from '../../../state/store';
import type { PortalHost } from '../../portal-host';
import type { TabRankFields } from '../../../../domain/messages';
import type {
  DisplayedSuggestion,
  SearchActionModel,
  SearchActionModelOptions
} from '../../../../domain/search/suggestion-action-model';
import type { SiteSearchProvider } from '../../../../domain/search/types';
import type { ThemeVariant } from '../../../favicon/favicon-theme';
import type { HelpContextBlock } from '../../../../domain/search/help-center/types';

// A row's theme, as the surface builds it from favicon-theme; the list
// reads what is there and falls back for the rest.
export type ThemeValue = Partial<ThemeVariant> | null;
// A provider as rows carry it; command rows may leave fields out.
export type SuggestionProvider = Partial<SiteSearchProvider>;
type Translate = (key: string, fallback: string) => string;
export type SuggestionsSurface = 'newtab' | 'overlay';
export type SuggestionUpdateKind =
  | 'highlight'
  | 'content'
  | 'append'
  | 'structure';

// A row as the list draws it.
export interface Suggestion extends DisplayedSuggestion {
  titleHighlight?: {
    text: string;
    query: string;
    ranges: Array<[number, number]>;
  };
  // A help center page's matched passage.
  context?: HelpContextBlock[];
  // Which link a feedback row opens.
  feedbackKey?: string;
}

// An open tab as the list draws it, with its switch ranking when known.
export interface OpenTabSuggestion extends Partial<TabRankFields> {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  // Which tab list fetch it came from, for the rank debug line.
  _xTabFetchSeq?: number;
}

export interface SuggestionActionTagModel {
  action: string;
  keyLabel?: string;
}

export interface SuggestionActionModelResult {
  actionTags: SuggestionActionTagModel[];
  visitButtonAction: string;
  alwaysHideVisitButton: boolean;
  hasActionTags: boolean;
  hasSwitchAction: boolean;
}

interface SuggestionActionModel {
  // The list tolerates any action name and reads a missing one as
  // openNewTab (see createActionModel).
  createSearchActionModel?: (
    options: SearchActionModelOptions
  ) => (Partial<Omit<SearchActionModel, 'visitButtonAction'>> & { visitButtonAction?: string | null }) | null;
  getModifierAdjustedAction?: (
    action: string,
    modifiers: {
      openInCurrentTab: boolean;
      openSwitchInNewTab: boolean;
      openInBackgroundTab: boolean;
    }
  ) => string;
  shouldShowVisitButton?: (
    model: SuggestionActionModelResult,
    active: boolean
  ) => boolean;
  getSuggestionPresentationFingerprint?: (
    suggestion: Suggestion,
    options?: { includeDebugReasons?: boolean }
  ) => string;
  getSuggestionStructureIdentity?: (suggestion: Suggestion) => string;
}

// The pointer or focus event a cursor tooltip shows or moves for.
interface CursorTooltipInput {
  target?: EventTarget | null;
}

interface CursorTooltipOptions {
  maxWidth: number;
  shouldShow: (
    target: HTMLElement,
    inputEvent: CursorTooltipInput | null
  ) => boolean;
  deferHideVisibility: boolean;
  preserveVisibleOnTargetSwitch: boolean;
  renderContent?: (
    element: HTMLElement,
    text: string
  ) => HTMLElement;
}

export interface FaviconCandidates {
  primaryUrl?: string;
  browserUrl?: string;
  allowRemoteImage?: boolean;
}

export interface ModeTheme {
  accent?: string;
  buttonText?: string;
  buttonBg?: string;
  buttonBorder?: string;
  tagBg?: string;
  tagText?: string;
  tagBorder?: string;
}

export interface SuggestionUtilityActionElements {
  slot: HTMLDivElement;
  button: HTMLButtonElement;
}

export interface SuggestionIconSlotElement extends HTMLSpanElement {
  _xIsFavicon?: boolean;
}

export interface SuggestionElement extends HTMLDivElement {
  _xIsSearchSuggestion?: boolean;
  _xIsAutocompleteTop?: boolean;
  _xTheme?: ThemeValue;
  _xThemeHost?: string;
  _xVisitButtonAction?: string;
  _xSuggestion?: Suggestion;
  _xTabId?: number | null;
}

export interface SuggestionsRenderPayload {
  suggestions?: Suggestion[];
  query?: string;
  updateKind?: SuggestionUpdateKind;
  canAppend?: boolean;
  startIndex?: number;
  primaryHighlightIndex?: number;
  primarySuggestion?: Suggestion | null;
  primaryHighlightReason?: string;
  onlyKeywordSuggestions?: boolean;
  mergedProvider?: SuggestionProvider | null;
  emptyMessage?: string;
  // The empty-state illustration to show with emptyMessage.
  emptyArt?: 'noResults' | 'noCommands' | 'noTabs';
}

export interface SuggestionsViewOptions {
  surface?: SuggestionsSurface;
  document?: Document;
  container?: HTMLElement | null;
  // The page's React root, which draws the list into its container.
  portals: PortalHost;
  items?: SuggestionElement[];
  t?: Translate;
  formatMessage?: (
    key: string,
    fallback: string,
    values?: Record<string, string>
  ) => string;
  actionModel?: SuggestionActionModel;
  sanitizeDisplayText?: (value: unknown) => string;
  formatTabRankDebugText?: (tab: OpenTabSuggestion) => string;
  isTabRankScoreDebugEnabled?: () => boolean;
  shouldBlockFaviconForHost?: (host: string) => boolean;
  isLocalNetworkHost?: (host: string) => boolean;
  getChromeFaviconUrl?: (url: string) => string;
  getHostFromUrl?: (url: string) => string;
  getUrlDisplay?: (url: string) => string;
  isSimpleModeEnabled?: () => boolean;
  getThemeHostForSuggestion?: (suggestion: Suggestion) => string;
  getImmediateThemeForSuggestion?: (
    suggestion: Suggestion
  ) => ThemeValue;
  getThemeForSuggestion?: (
    suggestion: Suggestion
  ) => Promise<ThemeValue>;
  shouldUseUrlFallbackThemeForSuggestion?: (
    suggestion: Suggestion,
    theme: ThemeValue
  ) => boolean;
  getThemeForMode?: (theme: ThemeValue) => ModeTheme;
  getHoverColors?: (
    theme: ThemeValue
  ) => { bg?: string; border?: string; text?: string };
  getHighlightColors?: (
    theme: ThemeValue
  ) => { bg?: string; border?: string };
  getNeutralHoverActionColors?: () => {
    bg?: string;
    border?: string;
    text?: string;
  };
  applyThemeVariables?: (
    target: SuggestionElement,
    theme: ThemeValue
  ) => void;
  applyMarkVariables?: (
    target: HTMLElement,
    theme: ThemeValue,
    active: boolean
  ) => void;
  applyFaviconOpticalAlignment?: (image: HTMLImageElement) => void;
  applyFaviconOpticalShift?: (image: HTMLImageElement) => void;
  setFaviconSrcWithAnimation?: (
    image: HTMLImageElement,
    source: string
  ) => boolean;
  applyFallbackIcon?: (image: HTMLImageElement) => void;
  attachFaviconWithFallbacks?: (
    image: HTMLImageElement,
    url: string,
    host: string,
    candidates: FaviconCandidates
  ) => void;
  getBrowserPageFaviconUrl?: (url: string) => string;
  getPageFaviconRenderCandidates?: (
    url: string,
    explicitUrl: string,
    options?: { includeChromeFallback?: boolean; allowRemoteImage?: boolean }
  ) => FaviconCandidates;
  preloadIcon?: (favicon: string, url: string) => void;
  setSuggestionsVisible?: (visible: boolean) => void;
  // The selected row, which the list follows and clears.
  selection?: SuggestionSelection;
  // The modifier keys held, which change the rows' action labels.
  modifiers?: { readonly store: Store<ModifierState> };
  onSwitchToTab?: (
    tab: OpenTabSuggestion,
    event: MouseEvent
  ) => void;
  onActivateSuggestion?: (
    suggestion: Suggestion,
    query: string,
    event: MouseEvent,
    index: number,
    item: SuggestionElement
  ) => void;
  onDeleteHistory?: (
    suggestion: Suggestion,
    query: string
  ) => void;
  onCopyUrl?: (url: string) => boolean | Promise<boolean> | void;
  shouldSwitchMatchedTabSuggestion?: (
    suggestion: Suggestion,
    index: number
  ) => boolean;
  showTopActionTooltip?: (
    target: HTMLElement,
    text: string
  ) => void;
  hideTopActionTooltip?: () => void;
  bindCursorTooltip?: (
    target: HTMLElement,
    getText: (
      target: HTMLElement,
      inputEvent?: CursorTooltipInput | null
    ) => string,
    options: CursorTooltipOptions
  ) => unknown;
  // Where a help center result's passage card goes; the document body when left out.
  getHelpPassageHost?: () => Node | null;
  getSearchActionLabel?: () => string;
  getSiteSearchDisplayName?: (
    provider: SuggestionProvider
  ) => string;
  isAiSiteSearchProvider?: (
    provider: SuggestionProvider
  ) => boolean;
  getDefaultSearchEngineThemeUrl?: () => string;
  getBrandAccentForUrl?: (url: string) => unknown;
  buildThemeFromAccent?: (
    accent: unknown,
    kind: string
  ) => ThemeValue;
  isBrowserNewtabUrl?: (url: string) => boolean;
  isBrowserInternalUrl?: (url: string) => boolean;
  defaultTheme?: ThemeValue;
  urlHighlightTheme?: ThemeValue;
  openTabSuggestionLimit?: number;
  openTabInitialRenderLimit?: number;
  getOpenTabInitialRenderLimit?: () => number;
  openTabRenderBatchSize?: number;
  getOpenTabRenderBatchSize?: () => number;
  enterAction?: string;
  autoHighlightFirstTab?: boolean;
}

export interface SuggestionsViewController {
  render(payload?: SuggestionsRenderPayload): void;
  renderTabs(tabList?: OpenTabSuggestion[]): void;
  // Draws the rows again after their themes changed outside the list.
  refreshRowStyles(): void;
  clear(): void;
  destroy(): void;
  getAutoHighlightIndex(): number;
  markAutocompleteTop(primaryHighlightIndex: number): void;
  getItems(): SuggestionElement[];
}

export interface NormalizedOptions {
  surface: SuggestionsSurface;
  document: Document;
  container: HTMLElement;
  portals: PortalHost;
  items: SuggestionElement[];
  t: Translate;
  formatMessage: NonNullable<SuggestionsViewOptions['formatMessage']>;
  actionModel: SuggestionActionModel;
  sanitizeDisplayText: NonNullable<
    SuggestionsViewOptions['sanitizeDisplayText']
  >;
  formatTabRankDebugText: NonNullable<
    SuggestionsViewOptions['formatTabRankDebugText']
  >;
  isTabRankScoreDebugEnabled: NonNullable<
    SuggestionsViewOptions['isTabRankScoreDebugEnabled']
  >;
  shouldBlockFaviconForHost: NonNullable<
    SuggestionsViewOptions['shouldBlockFaviconForHost']
  >;
  isLocalNetworkHost: NonNullable<
    SuggestionsViewOptions['isLocalNetworkHost']
  >;
  getChromeFaviconUrl: NonNullable<
    SuggestionsViewOptions['getChromeFaviconUrl']
  >;
  getHostFromUrl: NonNullable<SuggestionsViewOptions['getHostFromUrl']>;
  getUrlDisplay: NonNullable<SuggestionsViewOptions['getUrlDisplay']>;
  isSimpleModeEnabled: NonNullable<
    SuggestionsViewOptions['isSimpleModeEnabled']
  >;
  getThemeHostForSuggestion: NonNullable<
    SuggestionsViewOptions['getThemeHostForSuggestion']
  >;
  getImmediateThemeForSuggestion: NonNullable<
    SuggestionsViewOptions['getImmediateThemeForSuggestion']
  >;
  getThemeForSuggestion: NonNullable<
    SuggestionsViewOptions['getThemeForSuggestion']
  >;
  shouldUseUrlFallbackThemeForSuggestion: NonNullable<
    SuggestionsViewOptions['shouldUseUrlFallbackThemeForSuggestion']
  >;
  getThemeForMode: NonNullable<SuggestionsViewOptions['getThemeForMode']>;
  getHoverColors: NonNullable<SuggestionsViewOptions['getHoverColors']>;
  getHighlightColors: NonNullable<
    SuggestionsViewOptions['getHighlightColors']
  >;
  getNeutralHoverActionColors: NonNullable<
    SuggestionsViewOptions['getNeutralHoverActionColors']
  >;
  applyThemeVariables: NonNullable<
    SuggestionsViewOptions['applyThemeVariables']
  >;
  applyMarkVariables: NonNullable<
    SuggestionsViewOptions['applyMarkVariables']
  >;
  applyFaviconOpticalAlignment: NonNullable<
    SuggestionsViewOptions['applyFaviconOpticalAlignment']
  >;
  attachFaviconWithFallbacks: NonNullable<
    SuggestionsViewOptions['attachFaviconWithFallbacks']
  >;
  getPageFaviconRenderCandidates: NonNullable<
    SuggestionsViewOptions['getPageFaviconRenderCandidates']
  >;
  preloadIcon: NonNullable<SuggestionsViewOptions['preloadIcon']>;
  setSuggestionsVisible: NonNullable<
    SuggestionsViewOptions['setSuggestionsVisible']
  >;
  selection: SuggestionSelection;
  modifiers: { readonly store: Store<ModifierState> };
  onSwitchToTab: NonNullable<SuggestionsViewOptions['onSwitchToTab']>;
  onActivateSuggestion: NonNullable<
    SuggestionsViewOptions['onActivateSuggestion']
  >;
  onDeleteHistory: NonNullable<
    SuggestionsViewOptions['onDeleteHistory']
  >;
  onCopyUrl: NonNullable<SuggestionsViewOptions['onCopyUrl']>;
  shouldSwitchMatchedTabSuggestion: NonNullable<
    SuggestionsViewOptions['shouldSwitchMatchedTabSuggestion']
  >;
  showTopActionTooltip: NonNullable<
    SuggestionsViewOptions['showTopActionTooltip']
  >;
  hideTopActionTooltip: NonNullable<
    SuggestionsViewOptions['hideTopActionTooltip']
  >;
  bindCursorTooltip: SuggestionsViewOptions['bindCursorTooltip'];
  getSearchActionLabel: NonNullable<
    SuggestionsViewOptions['getSearchActionLabel']
  >;
  getSiteSearchDisplayName: NonNullable<
    SuggestionsViewOptions['getSiteSearchDisplayName']
  >;
  isAiSiteSearchProvider: NonNullable<
    SuggestionsViewOptions['isAiSiteSearchProvider']
  >;
  getDefaultSearchEngineThemeUrl: NonNullable<
    SuggestionsViewOptions['getDefaultSearchEngineThemeUrl']
  >;
  getBrandAccentForUrl: NonNullable<
    SuggestionsViewOptions['getBrandAccentForUrl']
  >;
  buildThemeFromAccent: NonNullable<
    SuggestionsViewOptions['buildThemeFromAccent']
  >;
  isBrowserNewtabUrl: NonNullable<
    SuggestionsViewOptions['isBrowserNewtabUrl']
  >;
  isBrowserInternalUrl: NonNullable<
    SuggestionsViewOptions['isBrowserInternalUrl']
  >;
  defaultTheme: ThemeValue;
  urlHighlightTheme: ThemeValue;
  openTabSuggestionLimit: number;
  openTabInitialRenderLimit: number;
  getOpenTabInitialRenderLimit: () => number;
  openTabRenderBatchSize: number;
  getOpenTabRenderBatchSize: () => number;
  enterAction: string;
  autoHighlightFirstTab: boolean;
}

export interface ModifierState {
  openInCurrentTab: boolean;
  openSwitchInNewTab: boolean;
  openInBackgroundTab: boolean;
}

// The list's own state: the row under the pointer, and a revision bumped
// when a row's theme changed outside the list.
export interface SuggestionListState {
  hoveredIndex: number;
  revision: number;
}

export interface SuggestionSelection {
  readonly store: Pick<Store<{ selectedIndex: number }>, 'getSnapshot' | 'subscribe'>;
  select(index: number): void;
}

export interface SuggestionsRuntime {
  options: NormalizedOptions;
  queryStore: QueryStore;
  listState: Store<SuggestionListState>;
}

export interface QueryStore {
  getSnapshot: () => string;
  subscribe: (listener: () => void) => () => void;
  set: (query: string) => void;
}

export interface SuggestionValueRef {
  current: Suggestion;
}

export interface IconSpec {
  kind: 'favicon' | 'inline';
  iconName?: RemixIconName;
  tone?: string;
  src?: string;
  attach?: boolean;
  url?: string;
  host?: string;
  favicon?: string;
  objectFitContain?: boolean;
  fallbackIconName?: RemixIconName;
  allowRemoteImage?: boolean;
}

export interface SearchSuggestionRowProps {
  runtime: SuggestionsRuntime;
  suggestionRef: SuggestionValueRef;
  suggestionFingerprint: string;
  index: number;
  isPrimary: boolean;
  primaryHighlightReason: string;
  isMergedHighlight: boolean;
  onlyKeywordSuggestions: boolean;
  last: boolean;
  simpleMode: boolean;
}
