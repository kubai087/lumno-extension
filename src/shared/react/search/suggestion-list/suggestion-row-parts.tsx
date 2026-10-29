// The two columns of a search suggestion row: its text (title, command,
// URL line, bookmark path and source tags) and its actions (the modifier
// action tags, the visit button and the copy and remove buttons).
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { RemixIcon } from '../../remix-icon';
import { getActionLabel, getModifierAction, getSuggestionUrlLineText } from './action-model';
import { HighlightedText } from './highlight';
import { canDeleteHistory, isTopSite, SuggestionUtilityAction } from './utility-action';
import type { RowRefs } from './suggestion-row-elements';
import type { RowSelection } from './action-styles';
import { surfaceClass } from './surface-options';
import type { ModifierState, NormalizedOptions, QueryStore, Suggestion, SuggestionActionModelResult, SuggestionsRuntime,
  SuggestionValueRef } from './types';

interface RowTextProps {
  options: NormalizedOptions;
  suggestion: Suggestion;
  queryStore: QueryStore;
  simpleMode: boolean;
  refs: RowRefs;
  // The overlay marks rows whose tab is already open.
  showOpenTabTag: boolean;
}

// A tag naming where the row comes from: history, a top site, a bookmark
// or an open tab.
function SourceTag({ options, tagRef, type, label }: {
  options: NormalizedOptions;
  tagRef: RefObject<HTMLSpanElement | null>;
  type: string;
  label: string;
}) {
  return (
    <span ref={tagRef} className={surfaceClass(options, 'x-nt-suggestion-tag')} data-visible="true" data-tag-type={type}>
      {label}
    </span>
  );
}

// The ranking reasons a debug build shows under the title.
function readReasons(suggestion: Suggestion): string {
  return Array.isArray(suggestion.reasons)
    ? suggestion.reasons.map((reason) => String(reason || '').trim()).filter(Boolean).join(' · ')
    : '';
}

function showsUrlLine(suggestion: Suggestion): boolean {
  return (suggestion.type === 'history' && !suggestion.isTopSite) ||
    isTopSite(suggestion) ||
    (suggestion.type === 'helpArticle' && Boolean(suggestion.detail));
}

function RowTitle({ options, suggestion, queryStore, simpleMode, refs }: Omit<RowTextProps, 'showOpenTabTag'>) {
  const command = Boolean(suggestion.commandText);
  return (
    <>
      {command && (
        <span ref={refs.command} className={surfaceClass(options, 'x-nt-suggestion-command')}>
          <HighlightedText options={options} text={suggestion.commandText || ''} queryStore={queryStore} simpleMode={simpleMode} />
        </span>
      )}
      <span
        ref={refs.title}
        className={surfaceClass(options, command ? 'x-nt-suggestion-title x-nt-suggestion-command-description' : 'x-nt-suggestion-title')}
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
    </>
  );
}

function RowText({ options, suggestion, queryStore, simpleMode, refs, showOpenTabTag }: RowTextProps) {
  const reasons = options.isTabRankScoreDebugEnabled() ? readReasons(suggestion) : '';
  const historyRow = suggestion.type === 'history' && !suggestion.isTopSite;
  return (
    <div className={surfaceClass(options, 'x-nt-suggestion-text')}>
      <RowTitle options={options} queryStore={queryStore} refs={refs} simpleMode={simpleMode} suggestion={suggestion} />
      {reasons && <span className={surfaceClass(options, 'x-nt-suggestion-reason')}>{reasons}</span>}
      {showsUrlLine(suggestion) && (
        <span className={surfaceClass(options, 'x-nt-suggestion-url-line')}>
          <HighlightedText
            options={options}
            text={getSuggestionUrlLineText(options, suggestion)}
            queryStore={queryStore}
            simpleMode={simpleMode}
          />
        </span>
      )}
      {!simpleMode && historyRow && (
        <SourceTag label={options.t('search_tag_history', '历史')} options={options} tagRef={refs.historyTag} type="history" />
      )}
      {!simpleMode && isTopSite(suggestion) && (
        <SourceTag label={options.t('search_tag_top_site', '常用')} options={options} tagRef={refs.topSiteTag} type="top-site" />
      )}
      {suggestion.type === 'bookmark' && suggestion.path && (
        <span className={surfaceClass(options, 'x-nt-suggestion-bookmark-path')}>{String(suggestion.path)}</span>
      )}
      {suggestion.type === 'bookmark' && !simpleMode && (
        <SourceTag label={options.t('search_tag_bookmark', '书签')} options={options} tagRef={refs.bookmarkTag} type="bookmark" />
      )}
      {!simpleMode && showOpenTabTag && (
        <SourceTag label={options.t('search_tag_open_tab', '已打开')} options={options} tagRef={refs.openTabTag} type="open-tab" />
      )}
    </div>
  );
}

interface RowActionsProps {
  runtime: SuggestionsRuntime;
  suggestion: Suggestion;
  suggestionRef: SuggestionValueRef;
  actionModel: SuggestionActionModelResult;
  simpleMode: boolean;
  refs: RowRefs;
  modifiers: ModifierState;
  // How the row stands in the selection as last drawn.
  readRow(): RowSelection | null;
  activate(event: ReactMouseEvent<HTMLElement>): void;
}

// The tags that show what the held modifier keys would do.
function ActionTags({ runtime, suggestion, actionModel, refs, modifiers }:
  Pick<RowActionsProps, 'runtime' | 'suggestion' | 'actionModel' | 'refs' | 'modifiers'>) {
  const { options } = runtime;
  return (
    <div ref={refs.actionTags} className={surfaceClass(options, 'x-nt-suggestion-action-tags')} data-visible="false">
      {actionModel.actionTags.map((tag, tagIndex) => (
        <span
          key={`${tag.action}:${tagIndex}`}
          className={surfaceClass(options, 'x-nt-suggestion-action-tag')}
          data-action={tag.action}
        >
          <span className={surfaceClass(options, 'x-nt-suggestion-action-tag__label')}>
            {getActionLabel(runtime, getModifierAction(runtime, tag.action, modifiers), suggestion)}
          </span>
        </span>
      ))}
    </div>
  );
}

function VisitButton({ runtime, suggestion, actionModel, simpleMode, refs, modifiers, activate }:
  Pick<RowActionsProps, 'runtime' | 'suggestion' | 'actionModel' | 'simpleMode' | 'refs' | 'modifiers' | 'activate'>) {
  const { options } = runtime;
  const label = getActionLabel(runtime, getModifierAction(runtime, actionModel.visitButtonAction, modifiers), suggestion);
  return (
    <button
      ref={refs.visitButton}
      type="button"
      className={surfaceClass(options, 'x-nt-suggestion-action-button x-nt-suggestion-visit-button')}
      data-visible={actionModel.alwaysHideVisitButton ? 'false' : 'true'}
      aria-label={label}
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
      <span className={surfaceClass(options, 'x-nt-suggestion-action-button__label')}>
        {label}
      </span>
      {simpleMode && (
        <span className={surfaceClass(options, 'x-nt-suggestion-action-button__icon')}>
          <RemixIcon name="ri-arrow-right-line" size={12} />
        </span>
      )}
    </button>
  );
}

function RowActions(props: RowActionsProps) {
  const { runtime, suggestion, suggestionRef, actionModel, refs, modifiers, readRow } = props;
  const { options, queryStore } = runtime;
  const copyableUrl = suggestion.commandText ? '' : String(suggestion.url || '').trim();
  const deleteTooltip = isTopSite(suggestion)
    ? options.t('search_remove_top_site_tooltip', '移除该常用')
    : options.t('search_remove_history_tooltip', '移除该历史');
  return (
    <div
      className={surfaceClass(options, 'x-nt-suggestion-right')}
      data-action-column={!actionModel.alwaysHideVisitButton || actionModel.hasActionTags ? 'true' : undefined}
    >
      <ActionTags actionModel={actionModel} modifiers={modifiers} refs={refs} runtime={runtime} suggestion={suggestion} />
      <VisitButton {...props} />
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
      {canDeleteHistory(suggestion) && (
        <SuggestionUtilityAction
          options={options}
          readRow={readRow}
          slotRef={refs.deleteSlot}
          buttonRef={refs.deleteButton}
          leading={!copyableUrl}
          tooltip={deleteTooltip}
          iconName="ri-delete-bin-6-line"
          onActivate={() => {
            options.onDeleteHistory(suggestionRef.current, queryStore.getSnapshot());
          }}
        />
      )}
    </div>
  );
}

export { RowActions, RowText };
