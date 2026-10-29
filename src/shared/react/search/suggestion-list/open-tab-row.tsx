// An open tab row.
import { useRef, useMemo, useLayoutEffect, type MouseEvent as ReactMouseEvent, type RefObject, memo } from 'react';
import type {
  SuggestionsRuntime,
  OpenTabSuggestion,
  SuggestionElement,
  IconSpec,
  ModifierState,
  NormalizedOptions,
  Suggestion
} from './types';
import { getBrowserFallbackIcon } from './icon-spec';
import { SuggestionIcon } from './suggestion-icon';
import { SuggestionUtilityAction } from './utility-action';
import { isLocalUrlSuggestion, getActionLabel, getModifierAction } from './action-model';
import { surfaceClass } from './surface-options';
import { bindRowTooltip } from './highlight';
import { applyRowStyles } from './action-styles';
import type { RowSelection } from './action-styles';
import { useSiteTheme } from './suggestion-row-theme';
import { setHoveredRow, useRowView } from './row-state';
import { RemixIcon } from '../../remix-icon';

interface OpenTabRowProps {
  runtime: SuggestionsRuntime;
  tab: OpenTabSuggestion;
  index: number;
  last: boolean;
  simpleMode: boolean;
}

interface OpenTabRefs {
  item: RefObject<SuggestionElement | null>;
  iconSlot: RefObject<HTMLSpanElement | null>;
  title: RefObject<HTMLSpanElement | null>;
  switchButton: RefObject<HTMLButtonElement | null>;
  copySlot: RefObject<HTMLDivElement | null>;
  copyButton: RefObject<HTMLButtonElement | null>;
  actionTags: RefObject<HTMLDivElement | null>;
}

function useOpenTabRefs(): OpenTabRefs {
  return {
    item: useRef<SuggestionElement>(null),
    iconSlot: useRef<HTMLSpanElement>(null),
    title: useRef<HTMLSpanElement>(null),
    switchButton: useRef<HTMLButtonElement>(null),
    copySlot: useRef<HTMLDivElement>(null),
    copyButton: useRef<HTMLButtonElement>(null),
    actionTags: useRef<HTMLDivElement>(null)
  };
}

function readHost(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
}

// The tab's favicon, or a browser glyph for a blocked host or a browser New
// Tab without one.
function readOpenTabIcon(options: NormalizedOptions, tab: OpenTabSuggestion): IconSpec {
  const url = tab.url || '';
  const host = readHost(tab.url);
  const hasFavicon = Boolean(String(tab.favIconUrl || '').trim());
  if (options.shouldBlockFaviconForHost(host) || (!hasFavicon && options.isBrowserNewtabUrl(url))) {
    return { kind: 'inline', iconName: getBrowserFallbackIcon(options, url) || 'ri-link' };
  }
  return {
    kind: 'favicon',
    attach: true,
    url,
    favicon: tab.favIconUrl || '',
    host,
    fallbackIconName: getBrowserFallbackIcon(options, url)
  };
}

// Puts what the surfaces read on the row's element.
function publishOpenTab(item: SuggestionElement, tabId: number | null, autoTop: boolean, tabSuggestion: Suggestion): void {
  item._xIsSearchSuggestion = false;
  item._xIsAutocompleteTop = autoTop;
  item._xVisitButtonAction = 'switch';
  item._xSuggestion = tabSuggestion;
  item._xTabId = tabId;
}

function OpenTabActions({ runtime, tabSuggestion, simpleMode, refs, modifiers, readRow, copyableUrl, activate, onAuxClick }: {
  runtime: SuggestionsRuntime;
  tabSuggestion: Suggestion;
  simpleMode: boolean;
  refs: OpenTabRefs;
  modifiers: ModifierState;
  readRow(): RowSelection | null;
  copyableUrl: string;
  activate(event: ReactMouseEvent<HTMLElement>): void;
  onAuxClick(event: ReactMouseEvent<HTMLElement>): void;
}) {
  const { options } = runtime;
  const overlay = options.surface === 'overlay';
  const switchLabel = getActionLabel(runtime, getModifierAction(runtime, 'switch', modifiers), tabSuggestion);
  return (
    <div className={surfaceClass(options, 'x-nt-suggestion-right')} data-action-column="true">
      {overlay && (
        <div ref={refs.actionTags} className={surfaceClass(options, 'x-nt-suggestion-action-tags')} data-visible="false">
          <span className={surfaceClass(options, 'x-nt-suggestion-action-tag')}>
            <span className={surfaceClass(options, 'x-nt-suggestion-action-tag__label')}>{switchLabel}</span>
          </span>
        </div>
      )}
      <button
        ref={refs.switchButton}
        type="button"
        className={surfaceClass(options, 'x-nt-tab-switch-button')}
        data-visible="true"
        onClick={(event) => {
          event.stopPropagation();
          activate(event);
        }}
        onAuxClick={onAuxClick}
      >
        <span className={overlay ? 'x-ov-inline-label' : undefined}>
          {overlay ? switchLabel : options.t('switch_to_tab', '切换到标签页')}
        </span>
        {simpleMode && (
          <>
            {' '}
            <span className={overlay ? 'x-ov-inline-icon' : undefined}>
              <RemixIcon name="ri-arrow-right-line" size={12} />
            </span>
          </>
        )}
      </button>
      {copyableUrl && (
        <SuggestionUtilityAction
          options={options}
          readRow={readRow}
          slotRef={refs.copySlot}
          buttonRef={refs.copyButton}
          leading
          tooltip={options.t('search_copy_url_tooltip', '复制链接')}
          iconName="ri-file-copy-line"
          onActivate={() => {
            void options.onCopyUrl(copyableUrl);
          }}
        />
      )}
    </div>
  );
}

function OpenTabRowComponent({ runtime, tab, index, last, simpleMode }: OpenTabRowProps) {
  const { options } = runtime;
  const refs = useOpenTabRefs();
  const itemRef = refs.item;
  const iconSpec = readOpenTabIcon(options, tab);
  // One object per tab, so the row effect below reruns only when the tab
  // or its theme changes, not on every render.
  const themeSuggestion = useMemo<Suggestion>(
    () => ({ url: tab.url || '', favicon: tab.favIconUrl || '' }),
    [tab.favIconUrl, tab.url]
  );
  const themeSuggestionRef = useMemo(() => ({ current: themeSuggestion }), [themeSuggestion]);
  const localFallback = isLocalUrlSuggestion(options, themeSuggestion);
  const immediateTheme = useMemo(
    () => (localFallback
      ? options.urlHighlightTheme
      : options.getImmediateThemeForSuggestion(themeSuggestion) || options.defaultTheme),
    [localFallback, options, themeSuggestion]
  );
  const theme = useSiteTheme(runtime, themeSuggestionRef, immediateTheme, !localFallback);
  const titleText = options.sanitizeDisplayText(tab.title || options.t('untitled', '无标题'));
  const tabSuggestion = useMemo<Suggestion>(
    () => ({
      type: 'openTab',
      title: titleText,
      url: tab.url || '',
      favicon: tab.favIconUrl || '',
      _xMatchedTabId: typeof tab.id === 'number' ? tab.id : undefined
    }),
    [tab.favIconUrl, tab.id, tab.url, titleText]
  );
  const iconIsFavicon = iconSpec.kind === 'favicon';
  const autoTop = options.autoHighlightFirstTab && index === 0;
  const tabId = typeof tab.id === 'number' ? tab.id : null;
  const view = useRowView(runtime, index);
  const rowSelection = useRef<RowSelection | null>(null);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (item) {
      publishOpenTab(item, tabId, autoTop, tabSuggestion);
      bindRowTooltip(options, item, { getElement: () => refs.title.current });
    }
  }, [autoTop, itemRef, options, refs.title, tabId, tabSuggestion]);

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
    rowSelection.current = applyRowStyles(options, {
      item,
      iconSlot: refs.iconSlot.current,
      iconIsFavicon,
      directIconWrap: null,
      title: refs.title.current,
      visitButton: refs.switchButton.current,
      switchButton: refs.switchButton.current,
      sourceTags: [],
      openTabTag: null,
      tagContainer: refs.actionTags.current,
      utilityActions: refs.copySlot.current && refs.copyButton.current
        ? [{ slot: refs.copySlot.current, button: refs.copyButton.current }]
        : []
    }, {
      isSearch: false,
      actionModel: null,
      hasActionTags: options.surface === 'overlay',
      alwaysHideVisitButton: false,
      hasSwitchAction: true
    }, {
      selection: view.selection,
      hovering: view.hovering,
      autoTop,
      theme: theme || options.defaultTheme,
      simpleMode
    });
  }, [autoTop, iconIsFavicon, itemRef, options, refs, simpleMode, theme, view.dark, view.hovering, view.selection]);

  const activate = (event: ReactMouseEvent<HTMLElement>): void => {
    options.onSwitchToTab(tab, event.nativeEvent);
  };
  const handleAuxClick = (event: ReactMouseEvent<HTMLElement>): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    activate(event);
  };

  return (
    <div
      ref={itemRef}
      id={`_x_extension_${options.surface === 'overlay' ? '' : 'newtab_'}suggestion_item_${index}_2024_unique_`}
      className={surfaceClass(options, 'x-nt-suggestion-item')}
      data-last={last ? 'true' : 'false'}
      data-simple-mode={simpleMode ? 'true' : 'false'}
      onMouseEnter={() => setHoveredRow(runtime, index)}
      onMouseLeave={() => {
        if (runtime.listState.getSnapshot().hoveredIndex === index) {
          setHoveredRow(runtime, -1);
        }
      }}
      onClick={activate}
      onAuxClick={handleAuxClick}
    >
      <div className={surfaceClass(options, 'x-nt-suggestion-left')}>
        <SuggestionIcon spec={iconSpec} index={index} options={options} iconSlotRef={refs.iconSlot} />
        <span ref={refs.title} className={surfaceClass(options, 'x-nt-suggestion-title')}>
          {titleText}
        </span>
        {options.isTabRankScoreDebugEnabled() && (
          <span className={surfaceClass(options, 'x-nt-tab-rank-debug')}>{options.formatTabRankDebugText(tab)}</span>
        )}
      </div>
      <OpenTabActions
        activate={activate}
        copyableUrl={String(tab.url || '').trim()}
        modifiers={view.modifiers}
        readRow={() => rowSelection.current}
        onAuxClick={handleAuxClick}
        refs={refs}
        runtime={runtime}
        simpleMode={simpleMode}
        tabSuggestion={tabSuggestion}
      />
    </div>
  );
}

export const OpenTabRow = memo(OpenTabRowComponent);
