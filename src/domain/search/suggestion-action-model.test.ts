import { describe, expect, it } from 'vitest';
import * as actionModel from './suggestion-action-model';

const HISTORY = { type: 'history', title: 'Lumno', url: 'https://lumno.example/' };

describe('suggestion action model', () => {
  it.each([
    'commandNewTab',
    'commandSettings',
    'modeSwitch',
    'zenSwitch',
    'commandOpenTabs',
    'commandCopyUrl',
    'commandDocumentPip'
  ])('gives the %s command row no action button and no action tag', (type) => {
    expect(actionModel.getVisitButtonAction({ type })).toBeNull();
    const model = actionModel.createSearchActionModel({
      suggestion: { type },
      isPrimaryHighlight: true,
      primaryHighlightReason: 'command'
    });
    expect(model.alwaysHideVisitButton).toBe(true);
    expect(model.actionTags).toEqual([]);
  });

  it.each([
    ['openNewTab', { openInCurrentTab: true }, 'go'],
    ['search', { openInCurrentTab: true }, 'search'],
    ['openNewTab', { openInBackgroundTab: true }, 'openBackgroundTab'],
    ['go', { openInBackgroundTab: true }, 'openBackgroundTab'],
    ['openNewTab', { openInCurrentTab: true, openInBackgroundTab: true }, 'go'],
    ['switch', { openSwitchInNewTab: true }, 'openNewTab'],
    ['switch', { openInBackgroundTab: true }, 'openBackgroundTab'],
    ['switch', { openSwitchInNewTab: true, openInBackgroundTab: true }, 'openBackgroundTab'],
    ['switch', { openInCurrentTab: true, openSwitchInNewTab: true }, 'openNewTab'],
    ['switch', { openInCurrentTab: true, openSwitchInNewTab: true, openInBackgroundTab: true }, 'openNewTab'],
    ['go', { openInCurrentTab: true, currentTabByDefault: true }, 'openNewTab'],
    ['go', { openInCurrentTab: true }, 'go']
  ])('labels %s as the held modifiers %j change it', (action, modifiers, expected) => {
    expect(actionModel.getModifierAdjustedAction(action, modifiers)).toBe(expected);
  });

  it('offers go rather than a new tab on a surface that opens results in the current tab, leaving search alone', () => {
    const model = actionModel.createSearchActionModel({
      suggestion: HISTORY,
      isPrimaryHighlight: true,
      primaryHighlightReason: 'topSite',
      currentTabByDefault: true
    });
    expect([model.visitButtonAction, model.actionTags]).toEqual(['go', [{ action: 'go' }]]);
    expect(actionModel.createSearchActionModel({
      suggestion: { type: 'googleSuggest', searchQuery: 'lumno' },
      currentTabByDefault: true
    }).visitButtonAction).toBe('search');
  });

  it.each([
    [{}, 'newTab'],
    [{ openInCurrentTab: true }, 'currentTab'],
    [{ openInBackgroundTab: true }, 'backgroundTab'],
    [{ openInCurrentTab: true, openInBackgroundTab: true }, 'currentTab'],
    [{ openSwitchInNewTab: true, openInBackgroundTab: true }, 'backgroundTab'],
    [{ currentTabByDefault: true }, 'currentTab'],
    [{ currentTabByDefault: true, openInCurrentTab: true }, 'newTab'],
    [{ currentTabByDefault: true, openInBackgroundTab: true }, 'backgroundTab'],
    [{ currentTabByDefault: true, openInCurrentTab: true, openInBackgroundTab: true }, 'newTab']
  ])('opens a result for %j in %s', (modifiers, disposition) => {
    expect(actionModel.getSearchResultOpenDisposition(modifiers)).toBe(disposition);
  });

  it('opens a matched tab again in a new tab with Shift only when the result has a URL', () => {
    expect(actionModel.shouldOpenSwitchActionInNewTab(
      { ...HISTORY, _xMatchedTabId: 42 },
      { action: 'switch', openSwitchInNewTab: true }
    )).toBe(true);
    expect(actionModel.shouldOpenSwitchActionInNewTab(
      { type: 'history', title: 'Missing URL', _xMatchedTabId: 42 },
      { action: 'switch', openSwitchInNewTab: true }
    )).toBe(false);
  });

  it('keeps only the action label on navigation, switch and keyword search rows', () => {
    const navigation = actionModel.createSearchActionModel({
      suggestion: HISTORY,
      isPrimaryHighlight: true,
      primaryHighlightReason: 'autocomplete',
      enterAction: 'openNewTab'
    });
    expect(navigation.actionTags).toEqual([{ action: 'openNewTab' }]);
    expect(navigation.alwaysHideVisitButton).toBe(false);
    expect(actionModel.createSearchActionModel({
      suggestion: HISTORY,
      isPrimaryHighlight: true,
      primaryHighlightReason: 'openTab',
      shouldSwitchMatchedTab: true
    }).actionTags).toEqual([{ action: 'switch' }]);
    expect(actionModel.createSearchActionModel({
      suggestion: { type: 'newtab', searchQuery: 'lumno' },
      isPrimaryHighlight: true,
      onlyKeywordSuggestions: true
    }).actionTags).toEqual([{ action: 'search' }]);
  });

  it('in simple mode keeps the plain action label, hides the visit button and drops the Search decoration', () => {
    const navigation = actionModel.createSearchActionModel({
      suggestion: HISTORY,
      isPrimaryHighlight: true,
      primaryHighlightReason: 'autocomplete',
      enterAction: 'openNewTab',
      simpleMode: true
    });
    expect(navigation.actionTags).toEqual([{ action: 'openNewTab' }]);
    expect(navigation.alwaysHideVisitButton).toBe(true);
    expect(actionModel.createSearchActionModel({
      suggestion: { type: 'newtab', searchQuery: 'lumno' },
      isPrimaryHighlight: true,
      onlyKeywordSuggestions: true,
      simpleMode: true
    }).actionTags).toEqual([]);
  });
});

describe('suggestion update kinds', () => {
  const DIRECT_BEFORE = { type: 'directUrl', title: '打开 https://code.0h', url: 'https://code.0h' };
  const DIRECT_AFTER = { type: 'directUrl', title: '打开 https://code.0htt', url: 'https://code.0htt' };
  const BOOKMARK = { type: 'bookmark', title: 'Docs', url: 'https://docs.example/' };
  const ROW = { type: 'history', title: 'Code', url: 'https://code.example/' };
  const kind = (currentSuggestions: object[], allSuggestions: object[]) => actionModel.getSuggestionUpdateKind({
    actionContextKey: '0|navigation|mixed',
    lastRenderedActionContextKey: '0|navigation|mixed',
    currentSuggestions,
    allSuggestions
  });

  it('keeps one row identity for a growing typed URL and redraws only its content', () => {
    expect(actionModel.getSuggestionStructureIdentity(DIRECT_BEFORE)).toBe(actionModel.getSuggestionStructureIdentity(DIRECT_AFTER));
    expect(kind([DIRECT_BEFORE, ROW], [DIRECT_AFTER, ROW])).toBe('content');
  });

  it('updates only the highlights for the same rows, whatever their ranking data', () => {
    expect(kind([ROW], [{ ...ROW }])).toBe('highlight');
    expect(kind(
      [{ ...ROW, score: 120, visitCount: 4, typedCount: 2, lastVisitTime: 100, reasons: ['标题前缀'] }],
      [{ ...ROW, score: 260, visitCount: 9, typedCount: 5, lastVisitTime: 200, reasons: ['URL 前缀'] }]
    )).toBe('highlight');
  });

  it('redraws content for changed text, appends new rows after a stable prefix, and rebuilds for a new order or a switch', () => {
    expect(kind([ROW], [{ ...ROW, title: 'Code Home' }])).toBe('content');
    expect(kind([ROW], [ROW, BOOKMARK])).toBe('append');
    expect(kind([ROW, BOOKMARK], [BOOKMARK, ROW])).toBe('structure');
    expect(kind([DIRECT_BEFORE], [{ ...DIRECT_AFTER, _xMatchedTabId: 42 }])).toBe('structure');
  });
});
