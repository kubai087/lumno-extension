// A search, history, bookmark or help center suggestion row.
import { useRef, useMemo, useLayoutEffect, type MouseEvent as ReactMouseEvent, memo } from 'react';
import type {
  SearchSuggestionRowProps,
  SuggestionElement,
  SuggestionActionTagElement,
  SuggestionUtilityActionElements
} from './types';
import {
  isLocalUrlSuggestion,
  createActionModel,
  resolveTheme,
  getSuggestionUrlLineText,
  getActionLabel,
  getModifierAction
} from './action-model';
import {
  getSuggestionIconSpec,
  canDeleteHistory,
  isTopSite,
  SuggestionIcon,
  SuggestionUtilityAction
} from './suggestion-icon';
import { surfaceCssValue, surfaceClass } from './surface-options';
import { bindTextTooltip, HighlightedText } from './highlight';
import { isHelpPassage } from '../help-passage-card';
import { setIconEmphasis } from './action-styles';
import { queryHtmlElement, queryHtmlTag } from '../../../dom-lookup';
import { innerHtml } from '../../inner-html';

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
  const itemRef = useRef<SuggestionElement>(null);
  const iconSlotRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const commandRef = useRef<HTMLSpanElement>(null);
  const historyTagRef = useRef<SuggestionActionTagElement>(null);
  const bookmarkTagRef = useRef<SuggestionActionTagElement>(null);
  const topSiteTagRef = useRef<SuggestionActionTagElement>(null);
  const openTabTagRef = useRef<SuggestionActionTagElement>(null);
  const actionTagsRef = useRef<HTMLDivElement>(null);
  const visitButtonRef = useRef<HTMLButtonElement>(null);
  const visitLabelRef = useRef<HTMLSpanElement>(null);
  const copySlotRef = useRef<HTMLDivElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const deleteSlotRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const primarySearch =
    isPrimary && suggestion.type === 'googleSuggest';
  const localFallback = isLocalUrlSuggestion(options, suggestion);
  const searchTheme =
    primarySearch ||
    (onlyKeywordSuggestions &&
      isPrimary &&
      suggestion.type === 'newtab');
  const themeHost = options.getThemeHostForSuggestion(suggestion);
  const usesUrlFallbackTheme =
    suggestion.type === 'directUrl' ||
    suggestion.type === 'browserPage' ||
    localFallback;
  const defaultSearchEngineThemeUrl =
    options.getDefaultSearchEngineThemeUrl();
  // The two memos below read the suggestion through its ref, so each one is
  // keyed on what it depends on instead: the suggestion's fingerprint, or what
  // the theme comes from in place of the suggestion.
  const immediateThemeKey = searchTheme
    ? defaultSearchEngineThemeUrl
    : usesUrlFallbackTheme
      ? 1
      : suggestionFingerprint;
  const iconSpecKey =
    suggestion.type === 'directUrl' ? '' : suggestionFingerprint;
  const immediateTheme = useMemo(() => {
    const latestSuggestion = suggestionRef.current;
    let nextTheme =
      options.getImmediateThemeForSuggestion(latestSuggestion) ||
      options.defaultTheme;
    if (usesUrlFallbackTheme) {
      nextTheme = options.urlHighlightTheme;
    }
    if (searchTheme) {
      const accent = options.getBrandAccentForUrl(
        defaultSearchEngineThemeUrl
      );
      if (accent) {
        nextTheme =
          options.buildThemeFromAccent(accent, 'brand') ||
          options.defaultTheme;
        if (nextTheme) {
          nextTheme._xIsBrand = true;
        }
      }
    }
    return nextTheme;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on immediateThemeKey
  }, [options, immediateThemeKey]);
  const iconSpec = useMemo(
    () => getSuggestionIconSpec(options, suggestionRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on iconSpecKey
    [options, iconSpecKey]
  );
  const command = Boolean(suggestion.commandText);
  const shouldSwitchMatchedTab =
    options.shouldSwitchMatchedTabSuggestion(
      suggestion,
      index
    );
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
    [
      isPrimary,
      isMergedHighlight,
      onlyKeywordSuggestions,
      options,
      primaryHighlightReason,
      primarySearch,
      simpleMode,
      shouldSwitchMatchedTab,
      suggestion
    ]
  );
  const actionTagRefs = useRef<SuggestionActionTagElement[]>([]);
  const copyableUrl = suggestion.commandText
    ? ''
    : String(suggestion.url || '').trim();
  const removable = canDeleteHistory(suggestion);
  const deleteTooltip = isTopSite(suggestion)
    ? options.t('search_remove_top_site_tooltip', '移除该常用')
    : options.t('search_remove_history_tooltip', '移除该历史');

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xIsSearchSuggestion = true;
    item._xThemeHost = themeHost;
    item._xIsAutocompleteTop = isPrimary;
    item._xIconWrap = iconSlotRef.current;
    item._xIconIsFavicon =
      iconSpec.kind === 'favicon' &&
      iconSlotRef.current?.getAttribute('data-favicon') === 'true';
    item._xDirectIconWrap =
      suggestion.type === 'directUrl' ||
      suggestion.type === 'browserPage'
        ? iconSlotRef.current
        : null;
    item._xTitle = command
      ? commandRef.current
      : titleRef.current;
    item._xCommandLabel = command ? commandRef.current : null;
    item._xHistoryTag = historyTagRef.current;
    item._xBookmarkTag = bookmarkTagRef.current;
    item._xTopSiteTag = topSiteTagRef.current;
    item._xOpenTabTag = openTabTagRef.current;
    if (item._xHistoryTag) {
      item._xHistoryTag._xDefaultBg =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-bg, #F3F4F6)'
        );
      item._xHistoryTag._xDefaultText =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-text, #667085)'
        );
      item._xHistoryTag._xDefaultBorder = 'transparent';
    }
    if (item._xTopSiteTag) {
      item._xTopSiteTag._xDefaultBg =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-bg, #F3F4F6)'
        );
      item._xTopSiteTag._xDefaultText =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-text, #667085)'
        );
      item._xTopSiteTag._xDefaultBorder = 'transparent';
    }
    if (item._xBookmarkTag) {
      item._xBookmarkTag._xDefaultBg =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-bg, #F3F4F6)'
        );
      item._xBookmarkTag._xDefaultText =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-text, #667085)'
        );
      item._xBookmarkTag._xDefaultBorder = 'transparent';
    }
    if (item._xOpenTabTag) {
      item._xOpenTabTag._xDefaultBg = surfaceCssValue(
        options,
        'var(--x-nt-tag-bg, #F3F4F6)'
      );
      item._xOpenTabTag._xDefaultText = surfaceCssValue(
        options,
        'var(--x-nt-tag-text, #667085)'
      );
      item._xOpenTabTag._xDefaultBorder = 'transparent';
    }
    item._xTagContainer = actionTagsRef.current;
    item._xActionModel = actionModel;
    item._xHasActionTags = actionModel.hasActionTags;
    item._xVisitButton = visitButtonRef.current;
    item._xVisitButtonLabel = visitLabelRef.current;
    item._xVisitButtonAction = actionModel.visitButtonAction;
    item._xActionTags = actionTagRefs.current;
    item._xActionTags.forEach((tag) => {
      tag._xActionLabel = queryHtmlTag(tag, `.${surfaceClass(
          options,
          'x-nt-suggestion-action-tag__label'
        )}`, 'span');
    });
    item._xSuggestion = suggestionRef.current;
    item._xAlwaysHideVisitButton =
      actionModel.alwaysHideVisitButton;
    item._xHasSwitchAction = actionModel.hasSwitchAction;
    item._xSimpleMode = simpleMode;
    item._xHistoryDeleteButton = deleteButtonRef.current;
    item._xUtilityActions = [
      copySlotRef.current && copyButtonRef.current
        ? {
            slot: copySlotRef.current,
            button: copyButtonRef.current
          }
        : null,
      deleteSlotRef.current && deleteButtonRef.current
        ? {
            slot: deleteSlotRef.current,
            button: deleteButtonRef.current
          }
        : null
    ].filter((action): action is SuggestionUtilityActionElements =>
      Boolean(action)
    );
  }, [
    actionModel,
    command,
    copyableUrl,
    iconSpec.kind,
    isPrimary,
    options,
    removable,
    suggestion.type,
    suggestionRef,
    simpleMode,
    themeHost
  ]);

  const shouldLoadTheme =
    !searchTheme &&
    (!onlyKeywordSuggestions || suggestion.type !== 'newtab') &&
    !usesUrlFallbackTheme;

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xTheme = immediateTheme;
    options.applyThemeVariables(item, immediateTheme);

    let active = true;
    if (shouldLoadTheme) {
      const latestSuggestion = suggestionRef.current;
      void options.getThemeForSuggestion(latestSuggestion).then((theme) => {
        if (!active || !item.isConnected) {
          return;
        }
        const nextTheme = resolveTheme(
          options,
          latestSuggestion,
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
    immediateTheme,
    options,
    runtime,
    simpleMode,
    shouldLoadTheme,
    suggestionRef
  ]);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    // The row is the hover target, not the title's line box: its padding, the
    // icon and the room after the ellipsis are part of the row too.
    bindTextTooltip(
      options,
      item,
      suggestion.title || '',
      titleRef.current
    );
    const urlLine = queryHtmlElement(item, `.${surfaceClass(options, 'x-nt-suggestion-url-line')}`);
    // A help center page's line shows the matched passage, so its tooltip shows the passage too,
    // unless the row has a passage card beside the list to show it in full.
    bindTextTooltip(
      options,
      urlLine,
      suggestion.type === 'helpArticle'
        ? isHelpPassage(suggestion.context) ? '' : suggestion.detail || ''
        : suggestion.url || ''
    );
  }, [
    options,
    suggestion.title,
    suggestion.type,
    suggestion.detail,
    suggestion.context,
    suggestion.url
  ]);

  const handleRowMouseEnter = (): void => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xIsHovering = true;
    setIconEmphasis(item, true);
    runtime.updateSelection(options.getSelectedIndex());
    if (options.items.indexOf(item) !== options.getSelectedIndex()) {
      if (
        options.getSelectedIndex() === -1 &&
        item._xIsAutocompleteTop
      ) {
        return;
      }
      item.setAttribute('data-row-state', 'hover');
    }
  };

  const activate = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    const item = itemRef.current;
    if (item) {
      options.onActivateSuggestion(
        suggestionRef.current,
        queryStore.getSnapshot(),
        event.nativeEvent,
        index,
        item
      );
    }
  };

  const preserveCommandInputFocus = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    if (command) {
      // New Tab clears slash commands on input blur, before click fires.
      event.preventDefault();
    }
  };

  const handleAuxClick = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    activate(event);
  };

  const showUrl =
    (suggestion.type === 'history' && !suggestion.isTopSite) ||
    isTopSite(suggestion) ||
    (suggestion.type === 'helpArticle' && Boolean(suggestion.detail));
  const urlLineText = getSuggestionUrlLineText(options, suggestion);

  return (
    <div
      ref={itemRef}
      id={`_x_extension_${options.surface === 'overlay' ? '' : 'newtab_'}suggestion_item_${index}_2024_unique_`}
      className={surfaceClass(options, 'x-nt-suggestion-item')}
      data-last={last ? 'true' : 'false'}
      data-row-state={isPrimary ? 'active' : undefined}
      data-command-row={command ? 'true' : undefined}
      data-simple-mode={simpleMode ? 'true' : 'false'}
      onMouseEnter={handleRowMouseEnter}
      onMouseDown={preserveCommandInputFocus}
      onMouseLeave={() => {
        if (itemRef.current) {
          itemRef.current._xIsHovering = false;
        }
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
        data-motion={
          options.surface === 'overlay' ? 'true' : undefined
        }
      >
        <SuggestionIcon
          spec={iconSpec}
          index={index}
          options={options}
          iconSlotRef={iconSlotRef}
        />
        <div
          className={surfaceClass(
            options,
            'x-nt-suggestion-text'
          )}
        >
          {command && (
            <span
              ref={commandRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-command'
              )}
            >
              <HighlightedText
                options={options}
                text={suggestion.commandText || ''}
                queryStore={queryStore}
                simpleMode={simpleMode}
              />
            </span>
          )}
          <span
            ref={titleRef}
            className={surfaceClass(
              options,
              command
                ? 'x-nt-suggestion-title x-nt-suggestion-command-description'
                : 'x-nt-suggestion-title'
            )}
          >
            {command ? (
              options.sanitizeDisplayText(suggestion.title || '')
            ) : (
              <HighlightedText
                options={options}
                text={suggestion.title || ''}
                queryStore={queryStore}
                simpleMode={simpleMode}
                highlight={suggestion.titleHighlight}
              />
            )}
          </span>
          {options.isTabRankScoreDebugEnabled() &&
            Array.isArray(suggestion.reasons) &&
            suggestion.reasons
              .map((reason) => String(reason || '').trim())
              .filter(Boolean).length > 0 && (
              <span
                className={surfaceClass(
                  options,
                  'x-nt-suggestion-reason'
                )}
              >
                {suggestion.reasons
                  .map((reason) => String(reason || '').trim())
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          {showUrl && (
            <span
              className={surfaceClass(
                options,
                'x-nt-suggestion-url-line'
              )}
            >
              <HighlightedText
                options={options}
                text={urlLineText}
                queryStore={queryStore}
                simpleMode={simpleMode}
              />
            </span>
          )}
          {!simpleMode && suggestion.type === 'history' &&
            !suggestion.isTopSite && (
            <span
              ref={historyTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-tag'
              )}
              data-visible="true"
              data-tag-type="history"
            >
              {options.t('search_tag_history', '历史')}
            </span>
          )}
          {!simpleMode && isTopSite(suggestion) && (
            <span
              ref={topSiteTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-tag'
              )}
              data-visible="true"
              data-tag-type="top-site"
            >
              {options.t('search_tag_top_site', '常用')}
            </span>
          )}
          {suggestion.type === 'bookmark' && (
            <>
              {suggestion.path && (
                <span
                  className={surfaceClass(
                    options,
                    'x-nt-suggestion-bookmark-path'
                  )}
                >
                  {String(suggestion.path)}
                </span>
              )}
              {!simpleMode && (
                <span
                  ref={bookmarkTagRef}
                  className={surfaceClass(
                    options,
                    'x-nt-suggestion-tag'
                  )}
                  data-visible="true"
                  data-tag-type="bookmark"
                >
                  {options.t('search_tag_bookmark', '书签')}
                </span>
              )}
            </>
          )}
          {!simpleMode && options.surface === 'overlay' &&
            shouldSwitchMatchedTab && (
            <span
              ref={openTabTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-tag'
              )}
              data-visible="true"
              data-tag-type="open-tab"
            >
              {options.t('search_tag_open_tab', '已打开')}
            </span>
          )}
        </div>
      </div>
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-right'
        )}
        data-action-column={
          !actionModel.alwaysHideVisitButton ||
          actionModel.hasActionTags
            ? 'true'
            : undefined
        }
      >
        <div
          ref={actionTagsRef}
          className={surfaceClass(
            options,
            'x-nt-suggestion-action-tags'
          )}
          data-visible="false"
        >
          {actionModel.actionTags.map((tag, tagIndex) => (
            <span
              ref={(node) => {
                if (node) {
                  const actionTag: SuggestionActionTagElement = node;
                  actionTagRefs.current[tagIndex] = actionTag;
                  actionTag._xAction = tag.action;
                  actionTag._xSuggestion = suggestionRef.current;
                  actionTag._xDefaultBg =
                    surfaceCssValue(
                      options,
                      'var(--x-nt-tag-bg, #F3F4F6)'
                    );
                  actionTag._xDefaultText =
                    surfaceCssValue(
                      options,
                      'var(--x-nt-tag-text, #6B7280)'
                    );
                  actionTag._xDefaultBorder = 'transparent';
                }
              }}
              key={`${tag.action}:${tagIndex}`}
              className={surfaceClass(
                options,
                'x-nt-suggestion-action-tag'
              )}
              data-action={tag.action}
            >
              <span
                ref={(node) => {
                  const tagNode =
                    actionTagRefs.current[tagIndex];
                  if (tagNode) {
                    tagNode._xActionLabel = node;
                  }
                }}
                className={surfaceClass(
                  options,
                  'x-nt-suggestion-action-tag__label'
                )}
              >
                {getActionLabel(
                  runtime,
                  getModifierAction(runtime, tag.action),
                  suggestion
                )}
              </span>
            </span>
          ))}
        </div>
        <button
          ref={visitButtonRef}
          type="button"
          className={surfaceClass(
            options,
            'x-nt-suggestion-action-button x-nt-suggestion-visit-button'
          )}
          data-visible={
            actionModel.alwaysHideVisitButton ? 'false' : 'true'
          }
          aria-label={getActionLabel(
            runtime,
            getModifierAction(
              runtime,
              actionModel.visitButtonAction
            ),
            suggestion
          )}
          onClick={(event) => {
            event.stopPropagation();
            activate(event);
          }}
          onAuxClick={(event) => {
            if (event.button !== 1) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            activate(event);
          }}
        >
          <span
            ref={visitLabelRef}
            className={surfaceClass(
              options,
              'x-nt-suggestion-action-button__label'
            )}
          >
            {getActionLabel(
              runtime,
              getModifierAction(
                runtime,
                actionModel.visitButtonAction
              ),
              suggestion
            )}
          </span>
          {simpleMode && (
            <span
              className={surfaceClass(
                options,
                'x-nt-suggestion-action-button__icon'
              )}
              dangerouslySetInnerHTML={innerHtml(options.getRiSvg(
                  'ri-arrow-right-line',
                  'ri-size-12'
                ))}
            />
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
        {removable && (
          <SuggestionUtilityAction
            options={options}
            itemRef={itemRef}
            slotRef={deleteSlotRef}
            buttonRef={deleteButtonRef}
            leading={!copyableUrl}
            tooltip={deleteTooltip}
            iconName="ri-delete-bin-6-line"
            onActivate={() => {
              options.onDeleteHistory(
                suggestionRef.current,
                queryStore.getSnapshot()
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

export const SearchSuggestionRow = memo(SearchSuggestionRowComponent);
