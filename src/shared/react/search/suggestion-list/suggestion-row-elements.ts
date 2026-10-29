// The elements of a search suggestion row: the ones its selection styles
// reach (action-styles.ts), and the facts the surfaces read off the row's
// element (which suggestion it shows, its theme host, its visit action).
import { useRef } from 'react';
import type { RefObject } from 'react';
import type { RowStyleElements } from './action-styles';
import type { SuggestionElement, SuggestionUtilityActionElements, SuggestionValueRef } from './types';

interface RowRefs {
  item: RefObject<SuggestionElement | null>;
  iconSlot: RefObject<HTMLSpanElement | null>;
  title: RefObject<HTMLSpanElement | null>;
  command: RefObject<HTMLSpanElement | null>;
  historyTag: RefObject<HTMLSpanElement | null>;
  bookmarkTag: RefObject<HTMLSpanElement | null>;
  topSiteTag: RefObject<HTMLSpanElement | null>;
  openTabTag: RefObject<HTMLSpanElement | null>;
  actionTags: RefObject<HTMLDivElement | null>;
  visitButton: RefObject<HTMLButtonElement | null>;
  copySlot: RefObject<HTMLDivElement | null>;
  copyButton: RefObject<HTMLButtonElement | null>;
  deleteSlot: RefObject<HTMLDivElement | null>;
  deleteButton: RefObject<HTMLButtonElement | null>;
}

// What the surfaces read off the row's element.
interface PublishedRow {
  isPrimary: boolean;
  visitButtonAction: string;
}

function useRowRefs(): RowRefs {
  return {
    item: useRef<SuggestionElement>(null),
    iconSlot: useRef<HTMLSpanElement>(null),
    title: useRef<HTMLSpanElement>(null),
    command: useRef<HTMLSpanElement>(null),
    historyTag: useRef<HTMLSpanElement>(null),
    bookmarkTag: useRef<HTMLSpanElement>(null),
    topSiteTag: useRef<HTMLSpanElement>(null),
    openTabTag: useRef<HTMLSpanElement>(null),
    actionTags: useRef<HTMLDivElement>(null),
    visitButton: useRef<HTMLButtonElement>(null),
    copySlot: useRef<HTMLDivElement>(null),
    copyButton: useRef<HTMLButtonElement>(null),
    deleteSlot: useRef<HTMLDivElement>(null),
    deleteButton: useRef<HTMLButtonElement>(null)
  };
}

function readUtilityActions(refs: RowRefs): SuggestionUtilityActionElements[] {
  return [
    refs.copySlot.current && refs.copyButton.current ? { slot: refs.copySlot.current, button: refs.copyButton.current } : null,
    refs.deleteSlot.current && refs.deleteButton.current ? { slot: refs.deleteSlot.current, button: refs.deleteButton.current } : null
  ].filter((action): action is SuggestionUtilityActionElements => Boolean(action));
}

// The row's elements the selection styles reach.
function readRowStyleElements(item: SuggestionElement, refs: RowRefs, facts: { command: boolean; directIcon: boolean }): RowStyleElements {
  const iconSlot = refs.iconSlot.current;
  return {
    item,
    iconSlot,
    iconIsFavicon: iconSlot?.getAttribute('data-favicon') === 'true',
    directIconWrap: facts.directIcon ? iconSlot : null,
    title: facts.command ? refs.command.current : refs.title.current,
    visitButton: refs.visitButton.current,
    switchButton: null,
    sourceTags: [refs.historyTag.current, refs.bookmarkTag.current, refs.topSiteTag.current],
    openTabTag: refs.openTabTag.current,
    tagContainer: refs.actionTags.current,
    utilityActions: readUtilityActions(refs)
  };
}

// Puts what the surfaces read on the row's element.
function publishRow(item: SuggestionElement, row: PublishedRow, suggestionRef: SuggestionValueRef): void {
  item._xIsSearchSuggestion = true;
  item._xIsAutocompleteTop = row.isPrimary;
  item._xVisitButtonAction = row.visitButtonAction;
  item._xSuggestion = suggestionRef.current;
}

export type { PublishedRow, RowRefs };
export { publishRow, readRowStyleElements, useRowRefs };
