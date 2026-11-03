// What each suggestion row offers to do: its action tags, its visit button,
// how modifier keys change the action, and whether a new slate needs a full
// render or only new highlights.
import { getDefaultTabDisposition } from '../navigation-disposition';
import type { SiteSearchProvider, SuggestionLike } from './types';

type SearchAction = 'switch' | 'search' | 'open' | 'openNewTab' | 'openBackgroundTab' | 'openSplitView' | 'go';

type OpenDisposition = 'currentTab' | 'backgroundTab' | 'newTab' | 'splitTab';

// The keys held when a result is opened. `openInCurrentTab` is Shift, which
// flips a result to the other of the current and a new tab, and also opens a
// switch-to-tab row in a new tab (`openSwitchInNewTab`). Option/Alt opens a
// result in a split view beside the current tab.
interface OpenModifiers {
  openInCurrentTab?: boolean;
  openSwitchInNewTab?: boolean;
  openInBackgroundTab?: boolean;
  openInSplitView?: boolean;
  // The surface opens results in the current tab unless a key says otherwise.
  currentTabByDefault?: boolean;
}

// A provider as rows carry it; command rows add display fields.
interface DisplayedProvider extends Partial<SiteSearchProvider> {
  label?: string;
  displayName?: string;
  favicon?: string;
}

// A row as the suggestion list shows it.
interface DisplayedSuggestion extends SuggestionLike {
  favicon?: string;
  path?: string;
  detail?: string;
  recommended?: boolean;
  commandText?: string;
  // The other words that type a command row's command.
  commandAliases?: string[];
  provider?: DisplayedProvider | null;
  searchQuery?: string;
  forceSearch?: boolean;
  nextMode?: string;
  nextEnabled?: boolean;
  reasons?: unknown[];
}

type MaybeSuggestion = DisplayedSuggestion | null | undefined;

interface ActionTag {
  action: string;
}

interface SearchActionModel {
  actionTags: ActionTag[];
  visitButtonAction: SearchAction | null;
  alwaysHideVisitButton: boolean;
  hasActionTags: boolean;
  hasSwitchAction: boolean;
  hideSourceTags: boolean;
}

interface SearchActionModelOptions {
  suggestion?: MaybeSuggestion;
  isPrimaryHighlight?: boolean;
  primaryHighlightReason?: string;
  onlyKeywordSuggestions?: boolean;
  isPrimarySearchSuggest?: boolean;
  isMergedHighlight?: boolean;
  shouldSwitchMatchedTab?: boolean;
  simpleMode?: boolean;
  // What Enter does on the primary row.
  enterAction?: string;
  // Rows say 「前往」 rather than 「新开」: results open in the current tab.
  currentTabByDefault?: boolean;
}

interface ActionContextOptions {
  primarySuggestion?: MaybeSuggestion;
  primaryHighlightIndex?: number;
  primaryHighlightReason?: string;
  onlyKeywordSuggestions?: boolean;
  mergedProvider?: { key?: string } | null;
}

type SuggestionUpdateKind = 'highlight' | 'content' | 'append' | 'structure';

interface UpdateKindOptions {
  forceFullRerender?: boolean;
  currentSuggestions?: readonly DisplayedSuggestion[] | null;
  allSuggestions?: readonly DisplayedSuggestion[] | null;
  actionContextKey?: string;
  lastRenderedActionContextKey?: string;
  includeDebugReasons?: boolean;
}

const SITE_SEARCH_TYPES = new Set([
  'siteSearch',
  'inlineSiteSearch',
  'siteSearchPrompt'
]);

const COMMAND_SUGGESTION_TYPES = new Set([
  'commandNewTab',
  'commandSettings',
  'modeSwitch',
  'zenSwitch',
  'presentationSwitch',
  'webAppearanceSwitch',
  'commandOpenTabs',
  'commandCopyUrl',
  'commandDocumentPip'
]);

const PRIMARY_ACTION_REASONS = new Set<string>([
  'topSite',
  'inline',
  'autocomplete',
  'openTab',
  'currentOpenTab'
]);

function isDirectNavigationSuggestion(suggestion: MaybeSuggestion): boolean {
  return Boolean(
    suggestion &&
    (suggestion.type === 'directUrl' || suggestion.type === 'browserPage')
  );
}

function isSiteSearchSuggestion(suggestion: MaybeSuggestion): boolean {
  return Boolean(suggestion && SITE_SEARCH_TYPES.has(String(suggestion.type)));
}

function getVisitButtonAction(suggestion: MaybeSuggestion, options?: { shouldSwitchMatchedTab?: boolean } | null): SearchAction | null {
  const config = options || {};
  if (!suggestion) {
    return null;
  }
  if (COMMAND_SUGGESTION_TYPES.has(String(suggestion.type))) {
    return null;
  }
  if (suggestion.type === 'newtab') {
    return 'search';
  }
  if (config.shouldSwitchMatchedTab) {
    return 'switch';
  }
  if (isSiteSearchSuggestion(suggestion)) {
    return 'search';
  }
  if (isDirectNavigationSuggestion(suggestion)) {
    return 'open';
  }
  if (suggestion.type === 'googleSuggest') {
    return 'search';
  }
  return 'openNewTab';
}

// Shift flips a result between the current and a new tab.
function getOtherTabAction(rawAction: string, config: OpenModifiers): string | null {
  if (rawAction === 'openNewTab') {
    return 'go';
  }
  return config.currentTabByDefault && rawAction === 'go' ? 'openNewTab' : null;
}

// The actions that open an address, which Option/Alt opens in a split view.
const SPLIT_VIEW_ACTIONS: ReadonlySet<string> = new Set(['switch', 'open', 'openNewTab', 'go']);

function getModifierAdjustedAction(action: unknown, options?: OpenModifiers | null): string {
  const rawAction = String(action || '');
  const config = options || {};
  if (config.openInSplitView && SPLIT_VIEW_ACTIONS.has(rawAction)) {
    return 'openSplitView';
  }
  if (config.openSwitchInNewTab && rawAction === 'switch') {
    return config.openInBackgroundTab ? 'openBackgroundTab' : 'openNewTab';
  }
  const otherTabAction = config.openInCurrentTab ? getOtherTabAction(rawAction, config) : null;
  if (otherTabAction) {
    return otherTabAction;
  }
  if (config.openInBackgroundTab && !config.openInCurrentTab &&
      (rawAction === 'openNewTab' || rawAction === 'go' || rawAction === 'switch')) {
    return 'openBackgroundTab';
  }
  return rawAction;
}

function shouldOpenSwitchActionInNewTab(
  suggestion: MaybeSuggestion,
  options?: (OpenModifiers & { action?: string; shouldSwitchMatchedTab?: boolean }) | null
): boolean {
  const config = options || {};
  if (!config.openSwitchInNewTab || !suggestion || !suggestion.url) {
    return false;
  }
  const action = config.action || getVisitButtonAction(suggestion, config);
  return action === 'switch';
}

function getSearchResultOpenDisposition(options?: OpenModifiers | null): OpenDisposition {
  const config = options || {};
  return getDefaultTabDisposition({
    currentTabByDefault: config.currentTabByDefault,
    openInOtherTab: config.openInCurrentTab,
    openInSplitView: config.openInSplitView,
    openInBackgroundTab: config.openInBackgroundTab
  });
}

// The action tags the row shows: switch to its open tab, the Enter action
// of the primary row, and search for a keyword-only list.
// Whether the primary row shows its Enter action as a tag.
function showsPrimaryActionTag(config: SearchActionModelOptions, suggestion: MaybeSuggestion): boolean {
  return !config.isPrimarySearchSuggest &&
    Boolean(config.isPrimaryHighlight) &&
    !config.onlyKeywordSuggestions &&
    (
      PRIMARY_ACTION_REASONS.has(String(config.primaryHighlightReason || '')) ||
      isDirectNavigationSuggestion(suggestion) ||
      Boolean(config.isMergedHighlight)
    );
}

function getActionTags(config: SearchActionModelOptions, suggestion: MaybeSuggestion): ActionTag[] {
  const isPrimaryHighlight = Boolean(config.isPrimaryHighlight);
  const onlyKeywordSuggestions = Boolean(config.onlyKeywordSuggestions);
  const actionTags: ActionTag[] = [];
  if (config.shouldSwitchMatchedTab) {
    actionTags.push({ action: 'switch' });
  } else if (showsPrimaryActionTag(config, suggestion)) {
    // Results opened in the current tab by default say 「前往」.
    actionTags.push({ action: config.currentTabByDefault ? 'go' : (config.enterAction || 'openNewTab') });
  }
  if (!config.simpleMode && isPrimaryHighlight && onlyKeywordSuggestions && suggestion && suggestion.type === 'newtab') {
    actionTags.push({ action: 'search' });
  }
  return actionTags;
}

function createSearchActionModel(options?: SearchActionModelOptions | null): SearchActionModel {
  const config: SearchActionModelOptions = options || {};
  const suggestion = config.suggestion || null;
  const shouldSwitchMatchedTab = Boolean(config.shouldSwitchMatchedTab);
  const actionTags = getActionTags(config, suggestion);
  const defaultVisitButtonAction = getVisitButtonAction(suggestion, {
    shouldSwitchMatchedTab
  });
  const visitButtonAction = config.currentTabByDefault && defaultVisitButtonAction === 'openNewTab'
    ? 'go'
    : defaultVisitButtonAction;
  const alwaysHideVisitButton = Boolean(config.simpleMode) || !visitButtonAction || Boolean(
    suggestion && (suggestion.type === 'modeSwitch' || suggestion.type === 'zenSwitch' || suggestion.type === 'presentationSwitch')
  );

  return {
    actionTags,
    visitButtonAction,
    alwaysHideVisitButton,
    hasActionTags: actionTags.length > 0,
    hasSwitchAction: shouldSwitchMatchedTab,
    hideSourceTags: shouldSwitchMatchedTab
  };
}

function shouldShowVisitButton(
  model: { alwaysHideVisitButton?: boolean; visitButtonAction?: string | null; hasActionTags?: boolean } | null | undefined,
  isActive: boolean
): boolean {
  if (!model || model.alwaysHideVisitButton || !model.visitButtonAction) {
    return false;
  }
  return !(isActive && model.hasActionTags);
}

function getProviderKey(provider: { key?: string } | null | undefined): string {
  return provider && provider.key ? String(provider.key) : '';
}

// What decides the primary row's actions; a change means the rows need
// their action tags rendered again.
function getActionContextKey(options?: ActionContextOptions | null): string {
  const config: ActionContextOptions = options || {};
  const primarySuggestion = config.primarySuggestion || null;
  const matchedTabId = primarySuggestion && typeof primarySuggestion._xMatchedTabId === 'number'
    ? String(primarySuggestion._xMatchedTabId)
    : '';
  return [
    Number.isInteger(config.primaryHighlightIndex) ? String(config.primaryHighlightIndex) : '-1',
    String(config.primaryHighlightReason || ''),
    config.onlyKeywordSuggestions ? 'keyword' : 'mixed',
    getProviderKey(config.mergedProvider),
    primarySuggestion && primarySuggestion.type ? String(primarySuggestion.type) : '',
    primarySuggestion && primarySuggestion.url ? String(primarySuggestion.url) : '',
    getProviderKey(primarySuggestion && primarySuggestion.provider),
    matchedTabId
  ].join('|');
}

function getSuggestionProviderIdentity(suggestion: MaybeSuggestion): string {
  const provider = suggestion && suggestion.provider;
  if (!provider || typeof provider !== 'object') {
    return '';
  }
  return String(
    provider.key ||
    provider.id ||
    provider.template ||
    provider.name ||
    ''
  );
}

// Everything a row shows; equal fingerprints render the same.
function fingerprintText(value: unknown): string {
  return String(value || '');
}

// The provider fields a row shows, '' each when the row has no provider.
function providerFingerprint(provider: DisplayedProvider | null): string[] {
  if (!provider) {
    return ['', '', '', '', '', ''];
  }
  return [
    fingerprintText(provider.name),
    fingerprintText(provider.label),
    fingerprintText(provider.displayName),
    fingerprintText(provider.action),
    fingerprintText(provider.template),
    fingerprintText(provider.icon || provider.favicon)
  ];
}

function debugReasonsFingerprint(suggestion: NonNullable<MaybeSuggestion>, includeDebugReasons: boolean): string[] {
  if (!includeDebugReasons || !Array.isArray(suggestion.reasons)) {
    return [];
  }
  return suggestion.reasons.map((reason) => String(reason || '').trim()).filter(Boolean);
}

function getSuggestionPresentationFingerprint(
  suggestion: MaybeSuggestion,
  options?: { includeDebugReasons?: boolean } | null
): string {
  if (!suggestion || typeof suggestion !== 'object') {
    return '';
  }
  const config = options || {};
  const provider = suggestion.provider && typeof suggestion.provider === 'object'
    ? suggestion.provider
    : null;
  return JSON.stringify([
    ...[suggestion.type, suggestion.title, suggestion.url, suggestion.favicon, suggestion.path, suggestion.detail]
      .map(fingerprintText),
    suggestion.recommended === true,
    fingerprintText(suggestion.commandText),
    suggestion.isTopSite === true,
    getSuggestionProviderIdentity(suggestion),
    ...providerFingerprint(provider),
    fingerprintText(suggestion.searchQuery),
    suggestion.forceSearch === true,
    String(suggestion._xMatchedTabId ?? ''),
    fingerprintText(suggestion.nextMode),
    String(suggestion.nextEnabled ?? ''),
    debugReasonsFingerprint(suggestion, config.includeDebugReasons === true)
  ]);
}

// Which row a suggestion is, across slates.
// What a row is about, after its type: its URL, command, query or title.
function getContentIdentity(type: string, suggestion: NonNullable<MaybeSuggestion>, providerIdentity: string): string {
  const url = String(suggestion.url || '');
  if (url) {
    return `${type}:url:${url}`;
  }
  const commandText = String(suggestion.commandText || '');
  if (commandText) {
    return `${type}:command:${commandText}`;
  }
  const searchQuery = String(suggestion.searchQuery || '');
  if (providerIdentity || searchQuery) {
    return `${type}:provider:${providerIdentity}:query:${searchQuery}`;
  }
  return `${type}:title:${String(suggestion.title || '')}`;
}

function getSuggestionStructureIdentity(suggestion: MaybeSuggestion): string {
  if (!suggestion || typeof suggestion !== 'object') {
    return '';
  }
  const matchedTabId = suggestion._xMatchedTabId;
  if (typeof matchedTabId === 'number' ||
      (typeof matchedTabId === 'string' && matchedTabId)) {
    return `matched-tab:${String(matchedTabId)}`;
  }
  const type = String(suggestion.type || 'suggestion');
  if (type === 'directUrl' || type === 'newtab') {
    return `${type}:query-action`;
  }
  const providerIdentity = getSuggestionProviderIdentity(suggestion);
  if (SITE_SEARCH_TYPES.has(type)) {
    return `${type}:provider:${providerIdentity || 'default'}`;
  }
  return getContentIdentity(type, suggestion, providerIdentity);
}

function hasSameSuggestionSequence(
  previous: readonly DisplayedSuggestion[] | null | undefined,
  next: readonly DisplayedSuggestion[] | null | undefined,
  compare: (previous: DisplayedSuggestion, next: DisplayedSuggestion) => boolean
): boolean {
  if (!previous || !next || previous.length !== next.length) {
    return false;
  }
  return previous.every((item, index) => compare(item, next[index]));
}

function getSuggestionUpdateKind(options?: UpdateKindOptions | null): SuggestionUpdateKind {
  const config: UpdateKindOptions = options || {};
  if (config.forceFullRerender === true) {
    return 'structure';
  }
  const sameStructure = hasSameSuggestionSequence(
    config.currentSuggestions,
    config.allSuggestions,
    (previous, next) => {
      const identity = getSuggestionStructureIdentity(previous);
      return Boolean(identity && identity === getSuggestionStructureIdentity(next));
    }
  );
  const sameActionContext =
    config.actionContextKey === config.lastRenderedActionContextKey;
  if (sameStructure) {
    const sameContent = hasSameSuggestionSequence(
      config.currentSuggestions,
      config.allSuggestions,
      (previous, next) => getSuggestionPresentationFingerprint(previous, config) ===
        getSuggestionPresentationFingerprint(next, config)
    );
    return sameContent && sameActionContext ? 'highlight' : 'content';
  }
  const previous = config.currentSuggestions;
  const next = config.allSuggestions;
  const isStablePrefix = Boolean(sameActionContext &&
    previous &&
    next &&
    previous.length > 0 &&
    previous.length < next.length &&
    previous.every((item, index) => {
      const identity = getSuggestionStructureIdentity(item);
      return Boolean(identity && identity === getSuggestionStructureIdentity(next[index]));
    }));
  return isStablePrefix ? 'append' : 'structure';
}

export {
  createSearchActionModel,
  getVisitButtonAction,
  getModifierAdjustedAction,
  getSearchResultOpenDisposition,
  shouldOpenSwitchActionInNewTab,
  shouldShowVisitButton,
  getActionContextKey,
  getSuggestionPresentationFingerprint,
  getSuggestionStructureIdentity,
  getSuggestionUpdateKind
};
export type {
  ActionTag,
  DisplayedSuggestion,
  OpenDisposition,
  OpenModifiers,
  SearchAction,
  SearchActionModel,
  SearchActionModelOptions,
  SuggestionUpdateKind
};
