// A search, history, bookmark or help center suggestion row.
import { useMemo, useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject, memo } from 'react';
import type { NormalizedOptions, SearchSuggestionRowProps, SuggestionElement, SuggestionsRuntime,
  SuggestionValueRef } from './types';
import { createActionModel } from './action-model';
import { getSuggestionIconSpec } from './icon-spec';
import { SuggestionIcon } from './suggestion-icon';
import { surfaceClass } from './surface-options';
import { bindRowTooltip } from './highlight';
import { isHelpPassage } from '../help-passage-card';
import { applyRowStyles } from './action-styles';
import type { RowSelection } from './action-styles';
import { queryHtmlElement } from '../../../dom-lookup';
import { publishRow, readRowStyleElements, useRowRefs } from './suggestion-row-elements';
import { setHoveredRow, useRowView } from './row-state';
import { RowActions, RowText } from './suggestion-row-parts';
import { useRowTheme } from './suggestion-row-theme';

// The row's tooltip, which shows the text it cut short from anywhere on it.
// Bound once: the lines and the suggestion are read when the tooltip shows.
function useRowTooltip(options: NormalizedOptions, suggestionRef: SuggestionValueRef, itemRef: RefObject<SuggestionElement | null>,
  titleRef: RefObject<HTMLSpanElement | null>): void {
  useLayoutEffect(() => {
    const item = itemRef.current;
    bindRowTooltip(
      options,
      item,
      { getElement: () => titleRef.current },
      {
        getElement: () => item && queryHtmlElement(item, `.${surfaceClass(options, 'x-nt-suggestion-url-line')}`),
        // A help center page's line shows the matched passage, so its tooltip shows the passage too,
        // unless the row has a passage card beside the list to show it in full.
        getText: () => {
          const latest = suggestionRef.current;
          return latest.type === 'helpArticle'
            ? isHelpPassage(latest.context) ? '' : latest.detail || ''
            : latest.url || '';
        }
      }
    );
  }, [itemRef, options, suggestionRef, titleRef]);
}

// Hovering marks the row; a click or middle click activates it.
function useRowPointer(runtime: SuggestionsRuntime, itemRef: RefObject<SuggestionElement | null>,
  suggestionRef: SuggestionValueRef, index: number, command: boolean) {
  const { options, queryStore } = runtime;
  const activate = (event: ReactMouseEvent<HTMLElement>): void => {
    const item = itemRef.current;
    if (item) {
      options.onActivateSuggestion(suggestionRef.current, queryStore.getSnapshot(), event.nativeEvent, index, item);
    }
  };
  return {
    activate,
    onMouseEnter(): void {
      setHoveredRow(runtime, index);
    },
    onMouseLeave(): void {
      if (runtime.listState.getSnapshot().hoveredIndex === index) {
        setHoveredRow(runtime, -1);
      }
    },
    onMouseDown(event: ReactMouseEvent<HTMLElement>): void {
      if (command) {
        // New Tab clears slash commands on input blur, before click fires.
        event.preventDefault();
      }
    },
    onAuxClick(event: ReactMouseEvent<HTMLElement>): void {
      if (event.button === 1) {
        event.preventDefault();
        activate(event);
      }
    }
  };
}

function SearchSuggestionRowComponent({
  runtime,
  suggestionRef,
  suggestionFingerprint,
  index,
  isPrimary,
  primaryHighlightReason,
  isMergedHighlight,
  onlyKeywordSuggestions,
  last,
  simpleMode
}: SearchSuggestionRowProps) {
  const { options, queryStore } = runtime;
  const suggestion = suggestionRef.current;
  const refs = useRowRefs();
  const itemRef = refs.item;
  const theme = useRowTheme({ runtime, suggestionRef, suggestionFingerprint, isPrimary, onlyKeywordSuggestions });
  const view = useRowView(runtime, index);
  const rowSelection = useRef<RowSelection | null>(null);
  const iconSpecKey = suggestion.type === 'directUrl' ? '' : suggestionFingerprint;
  const iconSpec = useMemo(
    () => getSuggestionIconSpec(options, suggestionRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on iconSpecKey
    [options, iconSpecKey]
  );
  const command = Boolean(suggestion.commandText);
  const shouldSwitchMatchedTab = options.shouldSwitchMatchedTabSuggestion(suggestion, index);
  const primarySearch = isPrimary && suggestion.type === 'googleSuggest';
  const actionModel = useMemo(
    () => createActionModel(options, {
      suggestion,
      isPrimaryHighlight: isPrimary,
      isPrimarySearchSuggest: primarySearch,
      primaryHighlightReason,
      onlyKeywordSuggestions,
      isMergedHighlight,
      shouldSwitchMatchedTab,
      enterAction: options.enterAction,
      simpleMode
    }),
    [isPrimary, isMergedHighlight, onlyKeywordSuggestions, options, primaryHighlightReason, primarySearch, simpleMode,
      shouldSwitchMatchedTab, suggestion]
  );
  const directIcon = suggestion.type === 'directUrl' || suggestion.type === 'browserPage';

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (item) {
      publishRow(item, { isPrimary, visitButtonAction: actionModel.visitButtonAction }, suggestionRef);
    }
  }, [actionModel, isPrimary, itemRef, suggestion, suggestionRef]);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (item) {
      options.applyThemeVariables(item, theme);
    }
  }, [itemRef, options, theme, view.dark]);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    rowSelection.current = applyRowStyles(options, readRowStyleElements(item, refs, { command, directIcon }), {
      isSearch: true,
      actionModel,
      hasActionTags: actionModel.hasActionTags,
      alwaysHideVisitButton: actionModel.alwaysHideVisitButton,
      hasSwitchAction: actionModel.hasSwitchAction
    }, {
      selection: view.selection,
      hovering: view.hovering,
      autoTop: isPrimary,
      theme: theme || options.defaultTheme,
      simpleMode
    });
  }, [actionModel, command, directIcon, isPrimary, itemRef, options, refs, simpleMode, theme, view.dark, view.hovering,
    view.selection]);

  useRowTooltip(options, suggestionRef, itemRef, refs.title);

  const pointer = useRowPointer(runtime, itemRef, suggestionRef, index, command);

  return (
    <div
      ref={itemRef}
      id={`_x_extension_${options.surface === 'overlay' ? '' : 'newtab_'}suggestion_item_${index}_2024_unique_`}
      className={surfaceClass(options, 'x-nt-suggestion-item')}
      data-last={last ? 'true' : 'false'}
      data-row-state={isPrimary ? 'active' : undefined}
      data-command-row={command ? 'true' : undefined}
      data-simple-mode={simpleMode ? 'true' : 'false'}
      onMouseEnter={pointer.onMouseEnter}
      onMouseDown={pointer.onMouseDown}
      onMouseLeave={pointer.onMouseLeave}
      onClick={pointer.activate}
      onAuxClick={pointer.onAuxClick}
    >
      <div className={surfaceClass(options, 'x-nt-suggestion-left')} data-motion={options.surface === 'overlay' ? 'true' : undefined}>
        <SuggestionIcon spec={iconSpec} index={index} options={options} iconSlotRef={refs.iconSlot} />
        <RowText
          options={options}
          queryStore={queryStore}
          refs={refs}
          showOpenTabTag={options.surface === 'overlay' && shouldSwitchMatchedTab}
          simpleMode={simpleMode}
          suggestion={suggestion}
        />
      </div>
      <RowActions
        actionModel={actionModel}
        activate={pointer.activate}
        modifiers={view.modifiers}
        readRow={() => rowSelection.current}
        refs={refs}
        runtime={runtime}
        simpleMode={simpleMode}
        suggestion={suggestion}
        suggestionRef={suggestionRef}
      />
    </div>
  );
}

export const SearchSuggestionRow = memo(SearchSuggestionRowComponent);
