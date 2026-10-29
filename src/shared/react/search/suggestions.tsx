import { Fragment } from 'react';
import { flushSync } from 'react-dom';
import { createHelpPassageCard, isHelpPassage } from './help-passage-card';
import type {
  NormalizedOptions,
  SuggestionsViewOptions,
  Suggestion,
  SuggestionsRuntime,
  OpenTabSuggestion,
  SuggestionsViewController,
  SuggestionValueRef,
  SuggestionsRenderPayload
} from './suggestion-list/types';
import {
  surfaceClass,
  normalizeOptions,
  createQueryStore
} from './suggestion-list/surface-options';
import { getHighlightedParts } from './suggestion-list/highlight';
import { SearchSuggestionRow } from './suggestion-list/search-suggestion-row';
import { OpenTabRow } from './suggestion-list/open-tab-row';
import { EmptyState, getHelpGroupCaptionStart } from './suggestion-list/empty-state';
import { queryHtmlTags } from '../../dom-lookup';
import { createStore } from '../../state/store';
export type {
  SuggestionsSurface,
  SuggestionUpdateKind,
  Suggestion,
  OpenTabSuggestion,
  SuggestionElement,
  SuggestionsRenderPayload,
  SuggestionsViewOptions,
  SuggestionsViewController
} from './suggestion-list/types';

function syncItems(options: NormalizedOptions): void {
  options.items.length = 0;
  queryHtmlTags(options.container, `.${surfaceClass(options, 'x-nt-suggestion-item')}`, 'div')
    .forEach((item) => options.items.push(item));
}

function createNoopController(
  rawOptions: SuggestionsViewOptions
): SuggestionsViewController {
  const items = Array.isArray(rawOptions.items)
    ? rawOptions.items
    : [];
  return {
    render() {},
    renderTabs() {},
    refreshRowStyles() {},
    clear() {
      items.length = 0;
    },
    destroy() {
      items.length = 0;
    },
    getAutoHighlightIndex() {
      return -1;
    },
    markAutocompleteTop() {},
    getItems() {
      return items;
    }
  };
}

function getStableRenderKeys<T>(
  values: T[],
  getIdentity: (value: T) => string
): string[] {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const identity = getIdentity(value);
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return `${identity}:occurrence:${occurrence}`;
  });
}

function updateSuggestionValueRefs(
  previous: Map<string, SuggestionValueRef>,
  renderKeys: string[],
  suggestions: Suggestion[]
): {
  refs: SuggestionValueRef[];
  byKey: Map<string, SuggestionValueRef>;
} {
  const byKey = new Map<string, SuggestionValueRef>();
  const refs = renderKeys.map((key, index) => {
    const valueRef = previous.get(key) || {
      current: suggestions[index]
    };
    valueRef.current = suggestions[index];
    byKey.set(key, valueRef);
    return valueRef;
  });
  return { refs, byKey };
}

function syncLatestSuggestionMetadata(
  options: NormalizedOptions,
  suggestions: Suggestion[]
): void {
  options.items.forEach((item, index) => {
    const suggestion = suggestions[index];
    if (!suggestion) {
      return;
    }
    item._xSuggestion = suggestion;
  });
}

// Fills in rows below the first batch while the page is idle. Rows below
// the visible viewport are non-critical. Scheduling their synchronous React
// commits on animation frames competes directly with the host page while it
// is loading, so only fill them when Chromium reports idle time. The
// timeout fallback still yields multiple frames in browsers without
// requestIdleCallback.
class IdleBatches {
  private task: { id: number; kind: 'idle' | 'timeout' } | null = null;
  // Bumped by each cancel, so a batch scheduled before it does nothing.
  private generation = 0;
  private readonly win: (Window & typeof globalThis) | null;

  constructor(win: (Window & typeof globalThis) | null) {
    this.win = win;
  }

  // Runs `step` in idle time, again while it returns true.
  start(step: () => boolean): void {
    const win = this.win;
    if (!win) {
      return;
    }
    const generation = this.generation;
    const run = (): void => {
      this.task = null;
      if (generation === this.generation && step() && generation === this.generation) {
        schedule();
      }
    };
    const schedule = (): void => {
      this.task = typeof win.requestIdleCallback === 'function'
        ? { id: win.requestIdleCallback(run, { timeout: 500 }), kind: 'idle' }
        : { id: win.setTimeout(run, 48), kind: 'timeout' };
    };
    schedule();
  }

  cancel(): void {
    this.generation += 1;
    const task = this.task;
    if (!task) {
      return;
    }
    if (this.win) {
      if (task.kind === 'idle' && typeof this.win.cancelIdleCallback === 'function') {
        this.win.cancelIdleCallback(task.id);
      } else {
        this.win.clearTimeout(task.id);
      }
    }
    this.task = null;
  }
}

function getTabRenderIdentity(tab: OpenTabSuggestion): string {
  return typeof tab.id === 'number' ? `tab:id:${tab.id}` : `tab:url:${String(tab.url || '')}:title:${String(tab.title || '')}`;
}

// The suggestion rows, with the group captions of help center results.
function SuggestionRows({ runtime, payload, suggestions, renderKeys, refs, simpleMode, getFingerprint }: {
  runtime: SuggestionsRuntime;
  payload: SuggestionsRenderPayload;
  suggestions: Suggestion[];
  renderKeys: string[];
  refs: SuggestionValueRef[];
  simpleMode: boolean;
  getFingerprint(suggestion: Suggestion): string;
}) {
  const { options } = runtime;
  const primaryHighlightIndex = Number.isInteger(payload.primaryHighlightIndex) ? Number(payload.primaryHighlightIndex) : -1;
  return suggestions.map((suggestion, index) => {
    const caption = getHelpGroupCaptionStart(suggestions, index);
    const isPrimary = index === primaryHighlightIndex;
    return (
      <Fragment key={renderKeys[index]}>
        {caption && (
          <div className={surfaceClass(options, 'x-nt-suggestion-caption')} role="presentation">
            {options.t(caption[0], caption[1])}
          </div>
        )}
        <SearchSuggestionRow
          runtime={runtime}
          suggestionRef={refs[index]}
          suggestionFingerprint={getFingerprint(suggestion)}
          index={index}
          isPrimary={isPrimary}
          primaryHighlightReason={payload.primaryHighlightReason || 'none'}
          isMergedHighlight={Boolean(payload.mergedProvider && payload.primarySuggestion === suggestion && isPrimary)}
          onlyKeywordSuggestions={Boolean(payload.onlyKeywordSuggestions)}
          last={index === suggestions.length - 1}
          simpleMode={simpleMode}
        />
      </Fragment>
    );
  });
}

type StructureIdentity = NonNullable<NormalizedOptions['actionModel']['getSuggestionStructureIdentity']>;
type PresentationFingerprint = NonNullable<NormalizedOptions['actionModel']['getSuggestionPresentationFingerprint']>;

class SuggestionsView implements SuggestionsViewController {
  private destroyed = false;
  private lastRenderWasSuggestions = false;
  private lastSimpleModeEnabled: boolean;
  private suggestionValueRefs = new Map<string, SuggestionValueRef>();
  private readonly options: NormalizedOptions;
  private readonly runtime: SuggestionsRuntime;
  private readonly tabBatches: IdleBatches;
  private readonly helpPassage: ReturnType<typeof createHelpPassageCard>;
  private readonly getStructureIdentity: StructureIdentity;
  private readonly getPresentationFingerprint: PresentationFingerprint;
  private readonly unsubscribes: Array<() => void>;

  constructor(options: NormalizedOptions, rawOptions: SuggestionsViewOptions, getStructureIdentity: StructureIdentity,
    getPresentationFingerprint: PresentationFingerprint) {
    this.options = options;
    this.getStructureIdentity = getStructureIdentity;
    this.getPresentationFingerprint = getPresentationFingerprint;
    const queryStore = createQueryStore();
    options.container.setAttribute('data-react-island', 'suggestions');
    this.lastSimpleModeEnabled = options.isSimpleModeEnabled();
    this.tabBatches = new IdleBatches(options.document.defaultView);
    this.helpPassage = createHelpPassageCard({
      document: options.document,
      getHost: rawOptions.getHelpPassageHost || (() => options.document.body),
      getList: () => options.container,
      highlight: (text) => getHighlightedParts(options, text, queryStore.getSnapshot())
    });
    options.container.addEventListener('scroll', () => this.helpPassage.place(), { passive: true });
    this.runtime = {
      options,
      queryStore,
      listState: createStore({ hoveredIndex: -1, revision: 0 })
    };
    // A help center row shows its passage while hovered or selected.
    this.unsubscribes = [
      options.selection.store.subscribe(() => this.syncHelpPassage()),
      this.runtime.listState.subscribe(() => this.syncHelpPassage())
    ];
  }

  readonly render = (payload: SuggestionsRenderPayload = {}): void => {
    if (this.destroyed) {
      return;
    }
    const { options, runtime } = this;
    this.tabBatches.cancel();
    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    const query = payload.query || '';
    const simpleMode = options.isSimpleModeEnabled();
    const renderKeys = getStableRenderKeys(suggestions, this.getStructureIdentity);
    const nextValueRefs = updateSuggestionValueRefs(this.suggestionValueRefs, renderKeys, suggestions);
    this.suggestionValueRefs = nextValueRefs.byKey;
    if (payload.updateKind === 'highlight' && this.lastRenderWasSuggestions && simpleMode === this.lastSimpleModeEnabled) {
      flushSync(() => runtime.queryStore.set(query));
      syncLatestSuggestionMetadata(options, suggestions);
      return;
    }
    runtime.queryStore.set(query);
    const preserveSelection = payload.updateKind ? payload.updateKind !== 'structure' : Boolean(payload.canAppend);
    if (!preserveSelection) {
      options.selection.select(-1);
      runtime.listState.setState({ hoveredIndex: -1 });
    }
    if (suggestions.length === 0 && payload.emptyMessage) {
      this.renderEmpty(payload);
      return;
    }
    const getFingerprint = (suggestion: Suggestion): string => this.getPresentationFingerprint(suggestion, {
      includeDebugReasons: options.isTabRankScoreDebugEnabled()
    });
    this.options.portals.show(this.options.container, (
      <SuggestionRows
        getFingerprint={getFingerprint}
        payload={payload}
        refs={nextValueRefs.refs}
        renderKeys={renderKeys}
        runtime={runtime}
        simpleMode={simpleMode}
        suggestions={suggestions}
      />
    ));
    syncItems(options);
    syncLatestSuggestionMetadata(options, suggestions);
    this.lastRenderWasSuggestions = true;
    this.lastSimpleModeEnabled = simpleMode;
    this.syncHelpPassage();
  };

  // Renders the open tabs: the first batch now, the rest in idle time.
  readonly renderTabs = (tabList: OpenTabSuggestion[] = []): void => {
    if (this.destroyed) {
      return;
    }
    const { options } = this;
    this.tabBatches.cancel();
    this.suggestionValueRefs.clear();
    const tabs = Array.isArray(tabList) ? tabList.slice(0, Math.max(1, options.openTabSuggestionLimit)) : [];
    const simpleMode = options.isSimpleModeEnabled();
    const renderKeys = getStableRenderKeys(tabs, getTabRenderIdentity);
    const hasWindow = Boolean(options.document.defaultView);
    let renderedCount = hasWindow ? Math.min(tabs.length, Math.max(1, options.getOpenTabInitialRenderLimit())) : tabs.length;
    options.selection.select(-1);
    this.preloadTabIcons(tabs.slice(0, renderedCount));
    this.commitTabRows(tabs, renderKeys, renderedCount, simpleMode);
    this.lastRenderWasSuggestions = false;
    this.lastSimpleModeEnabled = simpleMode;
    options.setSuggestionsVisible(tabs.length > 0);
    if (renderedCount >= tabs.length) {
      return;
    }
    this.tabBatches.start(() => {
      if (this.destroyed) {
        return false;
      }
      const nextCount = Math.min(tabs.length, renderedCount + Math.max(1, options.getOpenTabRenderBatchSize()));
      this.preloadTabIcons(tabs.slice(renderedCount, nextCount));
      renderedCount = nextCount;
      this.commitTabRows(tabs, renderKeys, renderedCount, simpleMode);
      return renderedCount < tabs.length;
    });
  };

  // Draws the rows again after their themes changed outside the list.
  readonly refreshRowStyles = (): void => {
    const state = this.runtime.listState.getSnapshot();
    this.runtime.listState.setState({ revision: state.revision + 1 });
  };

  readonly clear = (): void => {
    if (this.destroyed) {
      return;
    }
    const { options } = this;
    this.tabBatches.cancel();
    options.hideTopActionTooltip();
    this.helpPassage.hide();
    this.options.portals.show(this.options.container, null);
    this.lastRenderWasSuggestions = false;
    this.suggestionValueRefs.clear();
    options.items.length = 0;
    options.selection.select(-1);
    options.setSuggestionsVisible(false);
  };

  readonly destroy = (): void => {
    if (this.destroyed) {
      return;
    }
    const { options } = this;
    this.tabBatches.cancel();
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    options.hideTopActionTooltip();
    this.helpPassage.destroy();
    this.options.portals.remove(this.options.container);
    this.destroyed = true;
    this.lastRenderWasSuggestions = false;
    options.items.length = 0;
    options.selection.select(-1);
    options.setSuggestionsVisible(false);
  };

  readonly getAutoHighlightIndex = (): number => {
    return this.options.items.findIndex((item) => Boolean(item?._xIsAutocompleteTop));
  };

  readonly markAutocompleteTop = (index: number): void => {
    this.options.items.forEach((item, itemIndex) => {
      item._xIsAutocompleteTop = itemIndex === index;
    });
  };

  readonly getItems = () => this.options.items;

  // A help center result shows its passage while it is hovered, or picked with the arrow keys.
  private syncHelpPassage(): void {
    if (this.destroyed) {
      return;
    }
    const { items, selection } = this.options;
    const hovered = items[this.runtime.listState.getSnapshot().hoveredIndex];
    const row = hovered || items[selection.store.getSnapshot().selectedIndex];
    const suggestion = row?._xSuggestion;
    if (!row || suggestion?.type !== 'helpArticle' || !isHelpPassage(suggestion.context)) {
      this.helpPassage.hide();
      return;
    }
    this.helpPassage.show(row, suggestion.context, { delay: Boolean(hovered) });
  }

  private renderEmpty(payload: SuggestionsRenderPayload): void {
    const { options } = this;
    this.options.portals.show(this.options.container, <EmptyState key="empty" options={options} message={payload.emptyMessage || ''} art={payload.emptyArt} />);
    options.items.length = 0;
    this.lastRenderWasSuggestions = false;
    options.selection.select(-1);
    options.setSuggestionsVisible(true);
  }

  private preloadTabIcons(tabs: OpenTabSuggestion[]): void {
    tabs.forEach((tab) => {
      if (tab.favIconUrl) {
        this.options.preloadIcon(String(tab.favIconUrl), String(tab.url || ''));
      }
    });
  }

  private commitTabRows(tabs: OpenTabSuggestion[], renderKeys: string[], count: number, simpleMode: boolean): void {
    this.options.portals.show(this.options.container, (
      tabs.slice(0, count).map((tab, index) => (
        <OpenTabRow
          key={renderKeys[index]}
          runtime={this.runtime}
          tab={tab}
          index={index}
          last={index === count - 1 && count === tabs.length}
          simpleMode={simpleMode}
        />
      ))
    ));
    syncItems(this.options);
  }

}

export function createSuggestionsView(rawOptions: SuggestionsViewOptions): SuggestionsViewController {
  const options = normalizeOptions(rawOptions);
  const getStructureIdentity = options?.actionModel.getSuggestionStructureIdentity;
  const getPresentationFingerprint = options?.actionModel.getSuggestionPresentationFingerprint;
  if (!options || typeof getStructureIdentity !== 'function' || typeof getPresentationFingerprint !== 'function') {
    return createNoopController(rawOptions);
  }
  return new SuggestionsView(options, rawOptions, getStructureIdentity, getPresentationFingerprint);
}
