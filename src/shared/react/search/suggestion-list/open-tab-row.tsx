// An open tab row.
import { useRef, useMemo, useLayoutEffect, type MouseEvent as ReactMouseEvent, memo } from 'react';
import type {
  SuggestionsRuntime,
  OpenTabSuggestion,
  SuggestionElement,
  SuggestionActionTagElement,
  IconSpec,
  Suggestion
} from './types';
import { getBrowserFallbackIcon, SuggestionIcon, SuggestionUtilityAction } from './suggestion-icon';
import {
  isLocalUrlSuggestion,
  resolveTheme,
  getActionLabel,
  getModifierAction
} from './action-model';
import { surfaceClass, setSurfaceStyle } from './surface-options';
import { bindTextTooltip } from './highlight';
import { setIconEmphasis } from './action-styles';
import { queryHtmlTag } from '../../../dom-lookup';
import { innerHtml } from '../../inner-html';

function OpenTabRowComponent({
  runtime,
  tab,
  index,
  last,
  simpleMode
}: {
  runtime: SuggestionsRuntime;
  tab: OpenTabSuggestion;
  index: number;
  last: boolean;
  simpleMode: boolean;
}) {
  const { options } = runtime;
  const itemRef = useRef<SuggestionElement>(null);
  const iconSlotRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const switchButtonRef = useRef<HTMLButtonElement>(null);
  const switchButtonLabelRef = useRef<HTMLSpanElement>(null);
  const copySlotRef = useRef<HTMLDivElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const actionTagsRef = useRef<HTMLDivElement>(null);
  const switchActionTagRef =
    useRef<SuggestionActionTagElement>(null);
  let host = '';
  try {
    host = tab.url ? new URL(tab.url).hostname : '';
  } catch {
    host = '';
  }
  const hasFavicon = Boolean(String(tab.favIconUrl || '').trim());
  const fallback =
    options.shouldBlockFaviconForHost(host) ||
    (!hasFavicon && options.isBrowserNewtabUrl(tab.url || ''));
  const iconSpec: IconSpec = fallback
    ? {
        kind: 'inline',
        iconName:
          getBrowserFallbackIcon(options, tab.url || '') || 'ri-link'
      }
    : {
        kind: 'favicon',
        attach: true,
        url: tab.url || '',
        favicon: tab.favIconUrl || '',
        host,
        fallbackIconName: getBrowserFallbackIcon(
          options,
          tab.url || ''
        )
      };
  // One object per tab, so the row effect below reruns only when the tab
  // or its theme changes, not on every render.
  const themeSuggestion = useMemo<Suggestion>(
    () => ({
      url: tab.url || '',
      favicon: tab.favIconUrl || ''
    }),
    [tab.favIconUrl, tab.url]
  );
  const localFallback = isLocalUrlSuggestion(
    options,
    themeSuggestion
  );
  const immediateTheme = localFallback
    ? options.urlHighlightTheme
    : options.getImmediateThemeForSuggestion(themeSuggestion) ||
      options.defaultTheme;
  const titleText = options.sanitizeDisplayText(
    tab.title || options.t('untitled', '无标题')
  );
  const tabSuggestion = useMemo<Suggestion>(
    () => ({
      type: 'openTab',
      title: titleText,
      url: tab.url || '',
      favicon: tab.favIconUrl || '',
      _xMatchedTabId:
        typeof tab.id === 'number' ? tab.id : undefined
    }),
    [tab.favIconUrl, tab.id, tab.url, titleText]
  );
  const copyableUrl = String(tab.url || '').trim();

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xIsSearchSuggestion = false;
    item._xIsAutocompleteTop =
      options.autoHighlightFirstTab && index === 0;
    item._xTheme = immediateTheme;
    item._xThemeHost =
      options.getThemeHostForSuggestion(themeSuggestion);
    item._xIconWrap = iconSlotRef.current;
    item._xIconIsFavicon = !fallback;
    item._xTitle = titleRef.current;
    item._xSwitchButton = switchButtonRef.current;
    item._xVisitButton = switchButtonRef.current;
    item._xVisitButtonLabel = switchButtonLabelRef.current;
    item._xVisitButtonAction = 'switch';
    item._xSuggestion = tabSuggestion;
    item._xTabId = typeof tab.id === 'number' ? tab.id : null;
    item._xSimpleMode = simpleMode;
    item._xUtilityActions =
      copySlotRef.current && copyButtonRef.current
        ? [{
            slot: copySlotRef.current,
            button: copyButtonRef.current
          }]
        : [];
    item._xTagContainer = actionTagsRef.current;
    item._xActionTags = switchActionTagRef.current
      ? [switchActionTagRef.current]
      : [];
    item._xHasActionTags =
      options.surface === 'overlay';
    if (switchActionTagRef.current) {
      switchActionTagRef.current._xAction = 'switch';
      switchActionTagRef.current._xSuggestion = tabSuggestion;
      switchActionTagRef.current._xActionLabel =
        queryHtmlTag(switchActionTagRef.current, `.${surfaceClass(
            options,
            'x-nt-suggestion-action-tag__label'
          )}`, 'span');
    }
    options.applyThemeVariables(item, immediateTheme);
    // The row answers for a clipped title, not just its line box.
    bindTextTooltip(options, item, titleText, titleRef.current);
    let active = true;
    if (!localFallback) {
      void options
        .getThemeForSuggestion(themeSuggestion)
        .then((theme) => {
          if (!active || !item.isConnected) {
            return;
          }
          const nextTheme = resolveTheme(
            options,
            themeSuggestion,
            theme
          );
          item._xTheme = nextTheme;
          options.applyThemeVariables(item, nextTheme);
          runtime.updateSelection(options.getSelectedIndex());
        });
    }
    return () => {
      active = false;
    };
  }, [
    fallback,
    immediateTheme,
    index,
    localFallback,
    options,
    runtime,
    simpleMode,
    tab.id,
    tabSuggestion,
    themeSuggestion,
    titleText
  ]);

  const activate = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    options.onSwitchToTab(tab, event.nativeEvent);
  };

  const handleAuxClick = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
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
      onMouseEnter={() => {
        const item = itemRef.current;
        if (!item) {
          return;
        }
        item._xIsHovering = true;
        setIconEmphasis(item, true);
        runtime.updateSelection(options.getSelectedIndex());
        if (options.items.indexOf(item) === options.getSelectedIndex()) {
          return;
        }
        if (
          options.getSelectedIndex() === -1 &&
          item._xIsAutocompleteTop
        ) {
          return;
        }
        const theme = item._xTheme;
        if (!simpleMode && theme?._xIsBrand) {
          const hover = options.getHoverColors(theme);
          setSurfaceStyle(
            options,
            item,
            '--x-nt-suggestion-hover-bg',
            hover.bg || ''
          );
        } else if (options.surface === 'overlay') {
          setSurfaceStyle(
            options,
            item,
            '--x-nt-suggestion-hover-bg',
            'var(--x-ov-hover-bg, #F3F4F6)'
          );
        }
        item.setAttribute('data-row-state', 'hover');
      }}
      onMouseLeave={() => {
        const item = itemRef.current;
        if (!item) {
          return;
        }
        item._xIsHovering = false;
        runtime.updateSelection(options.getSelectedIndex());
      }}
      onClick={activate}
      onAuxClick={handleAuxClick}
    >
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-left'
        )}
      >
        <SuggestionIcon
          spec={iconSpec}
          index={index}
          options={options}
          iconSlotRef={iconSlotRef}
        />
        <span
          ref={titleRef}
          className={surfaceClass(
            options,
            'x-nt-suggestion-title'
          )}
        >
          {titleText}
        </span>
        {options.isTabRankScoreDebugEnabled() && (
          <span
            className={surfaceClass(
              options,
              'x-nt-tab-rank-debug'
            )}
          >
            {options.formatTabRankDebugText(tab)}
          </span>
        )}
      </div>
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-right'
        )}
        data-action-column="true"
      >
        {options.surface === 'overlay' && (
          <div
            ref={actionTagsRef}
            className={surfaceClass(
              options,
              'x-nt-suggestion-action-tags'
            )}
            data-visible="false"
          >
            <span
              ref={switchActionTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-action-tag'
              )}
            >
              <span
                className={surfaceClass(
                  options,
                  'x-nt-suggestion-action-tag__label'
                )}
              >
                {getActionLabel(
                  runtime,
                  getModifierAction(runtime, 'switch'),
                  tabSuggestion
                )}
              </span>
            </span>
          </div>
        )}
        <button
          ref={switchButtonRef}
          type="button"
          className={surfaceClass(
            options,
            'x-nt-tab-switch-button'
          )}
          data-visible="true"
          onClick={(event) => {
            event.stopPropagation();
            activate(event);
          }}
          onAuxClick={handleAuxClick}
        >
          <span
            ref={switchButtonLabelRef}
            className={
              options.surface === 'overlay'
                ? 'x-ov-inline-label'
                : undefined
            }
          >
            {options.surface === 'overlay'
              ? getActionLabel(
                  runtime,
                  getModifierAction(runtime, 'switch'),
                  tabSuggestion
                )
              : options.t('switch_to_tab', '切换到标签页')}
          </span>
          {simpleMode && (
            <>
              {' '}
              <span
                className={
                  options.surface === 'overlay'
                    ? 'x-ov-inline-icon'
                    : undefined
                }
                dangerouslySetInnerHTML={innerHtml(options.getRiSvg(
                    'ri-arrow-right-line',
                    'ri-size-12'
                  ))}
              />
            </>
          )}
        </button>
        {copyableUrl && (
          <SuggestionUtilityAction
            options={options}
            itemRef={itemRef}
            slotRef={copySlotRef}
            buttonRef={copyButtonRef}
            leading
            tooltip={options.t(
              'search_copy_url_tooltip',
              '复制链接'
            )}
            iconName="ri-file-copy-line"
            onActivate={() => {
              void options.onCopyUrl(copyableUrl);
            }}
          />
        )}
      </div>
    </div>
  );
}

export const OpenTabRow = memo(OpenTabRowComponent);
