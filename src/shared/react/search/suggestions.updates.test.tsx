import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Suggestion } from './suggestions';
import { createView, destroyViews, render, rowPart, rowParts } from '../../../../tests/fakes/suggestions';
import { createStore } from '../../state/store';

afterEach(destroyViews);

describe('Suggestion rows: updates, labels and commands', () => {
  it('keeps existing row nodes during an incremental append', () => {
    const { view, items } = createView();
    const suggestions: Suggestion[] = [
      {
        type: 'history',
        title: 'Example one',
        url: 'https://example.com/1'
      },
      {
        type: 'bookmark',
        title: 'Example two',
        url: 'https://example.com/2'
      }
    ];
    render(view, suggestions);
    const first = items[0];
    const second = items[1];

    render(
      view,
      suggestions.concat({
        type: 'history',
        title: 'Example three',
        url: 'https://example.com/3'
      }),
      {
        canAppend: true,
        startIndex: 2
      }
    );

    expect(items).toHaveLength(3);
    expect(items[0]).toBe(first);
    expect(items[1]).toBe(second);
    expect(items[1].dataset.last).toBe('false');
    expect(items[2].dataset.last).toBe('true');
  });

  it('binds one tooltip to the whole row for its title and address', () => {
    const bindCursorTooltip = vi.fn();
    const { view, items } = createView({ bindCursorTooltip });
    render(
      view,
      [
        {
          type: 'history',
          title: 'Example result',
          url: 'https://example.com/result'
        }
      ],
      {
        query: 'ex',
        updateKind: 'structure'
      }
    );

    const row = items[0];
    expect(bindCursorTooltip).toHaveBeenCalledTimes(1);
    expect(bindCursorTooltip.mock.calls[0][0]).toBe(row);
  });

  it('updates only the matching mark when result content is unchanged', () => {
    const bindCursorTooltip = vi.fn();
    const onSetSelectedIndex = vi.fn();
    const { view, items } = createView({
      bindCursorTooltip,
      selection: { store: createStore({ selectedIndex: -1 }), select: onSetSelectedIndex }
    });
    const suggestion: Suggestion = {
      type: 'history',
      title: 'Example result',
      url: 'https://example.com/result'
    };

    render(view, [suggestion], {
      query: 'ex',
      updateKind: 'structure'
    });
    const row = items[0];
    const mark = row.querySelector('mark');
    bindCursorTooltip.mockClear();
    onSetSelectedIndex.mockClear();

    render(view, [{ ...suggestion }], {
      query: 'exam',
      updateKind: 'highlight'
    });

    expect(items[0]).toBe(row);
    expect(items[0].querySelector('mark')).toBe(mark);
    expect(mark?.textContent).toBe('Exam');
    expect(bindCursorTooltip).not.toHaveBeenCalled();
    expect(onSetSelectedIndex).not.toHaveBeenCalledWith(-1);
  });

  it('keeps a direct URL action row mounted while its text grows', () => {
    const applyThemeVariables = vi.fn();
    const getImmediateThemeForSuggestion = vi.fn(() => ({
      accent: '#2563eb'
    }));
    const onActivateSuggestion = vi.fn();
    const onSetSelectedIndex = vi.fn();
    const { view, items } = createView({
      applyThemeVariables,
      getImmediateThemeForSuggestion,
      onActivateSuggestion,
      selection: { store: createStore({ selectedIndex: -1 }), select: onSetSelectedIndex }
    });
    const firstSuggestion: Suggestion = {
      type: 'directUrl',
      title: '打开 https://code.0h',
      url: 'https://code.0h',
      favicon: 'https://icons.example/first.png'
    };

    render(view, [firstSuggestion], {
      query: 'https://code.0h',
      updateKind: 'structure'
    });
    const row = items[0];
    const mark = row.querySelector('mark');
    const iconSlot = row.querySelector('.x-nt-suggestion-icon-slot');
    const inlineIcon = iconSlot?.firstElementChild;
    applyThemeVariables.mockClear();
    getImmediateThemeForSuggestion.mockClear();
    onSetSelectedIndex.mockClear();

    const nextSuggestion: Suggestion = {
      ...firstSuggestion,
      title: '打开 https://code.0htt',
      url: 'https://code.0htt',
      favicon: 'https://icons.example/second.png'
    };
    render(view, [nextSuggestion], {
      query: 'https://code.0htt',
      updateKind: 'content'
    });

    expect(items[0]).toBe(row);
    expect(items[0].querySelector('mark')).toBe(mark);
    expect(mark?.textContent).toBe('https://code.0htt');
    expect(row.querySelector('.x-nt-suggestion-icon-slot')).toBe(iconSlot);
    expect(iconSlot?.firstElementChild).toBe(inlineIcon);
    expect(iconSlot?.querySelector('img')).toBeNull();
    expect(iconSlot?.querySelector('.ri-link')).not.toBeNull();
    expect(items[0]._xSuggestion).toBe(nextSuggestion);
    expect(applyThemeVariables).not.toHaveBeenCalled();
    expect(getImmediateThemeForSuggestion).not.toHaveBeenCalled();
    expect(onSetSelectedIndex).not.toHaveBeenCalledWith(-1);

    act(() => {
      row.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0
      }));
    });
    expect(onActivateSuggestion).toHaveBeenLastCalledWith(
      nextSuggestion,
      'https://code.0htt',
      expect.any(MouseEvent),
      0,
      row
    );
  });

  it('keeps visible rows inert when only ranking metadata changes', () => {
    const applyThemeVariables = vi.fn();
    const attachFaviconWithFallbacks = vi.fn(
      (image: HTMLImageElement) => {
        image.src = 'data:image/png;base64,dGVzdA==';
      }
    );
    const bindCursorTooltip = vi.fn();
    const getThemeForSuggestion = vi.fn(
      () => new Promise<Record<string, unknown> | null>(() => {
        // Keep async theme resolution pending for deterministic tests.
      })
    );
    const onActivateSuggestion = vi.fn();
    const { view, items } = createView({
      applyThemeVariables,
      attachFaviconWithFallbacks,
      bindCursorTooltip,
      getThemeForSuggestion,
      onActivateSuggestion
    });
    const firstSuggestion: Suggestion = {
      type: 'history',
      title: 'Home - 0HTTP',
      url: 'https://code.0http.com/',
      favicon: 'https://code.0http.com/favicon.ico',
      score: 120,
      visitCount: 4,
      typedCount: 2,
      lastVisitTime: 100,
      reasons: ['标题前缀']
    };

    render(view, [firstSuggestion], {
      query: 'code.0h',
      updateKind: 'structure'
    });
    const row = items[0];
    const icon = row.querySelector('img');
    applyThemeVariables.mockClear();
    attachFaviconWithFallbacks.mockClear();
    bindCursorTooltip.mockClear();
    getThemeForSuggestion.mockClear();

    const nextSuggestion: Suggestion = {
      ...firstSuggestion,
      score: 260,
      visitCount: 9,
      typedCount: 5,
      lastVisitTime: 200,
      reasons: ['URL 前缀']
    };
    render(view, [nextSuggestion], {
      query: 'code.0h',
      updateKind: 'content'
    });

    expect(items[0]).toBe(row);
    expect(row.querySelector('img')).toBe(icon);
    expect(items[0]._xSuggestion).toBe(nextSuggestion);
    expect(applyThemeVariables).not.toHaveBeenCalled();
    expect(attachFaviconWithFallbacks).not.toHaveBeenCalled();
    expect(bindCursorTooltip).not.toHaveBeenCalled();
    expect(getThemeForSuggestion).not.toHaveBeenCalled();

    const latestSuggestion: Suggestion = {
      ...nextSuggestion,
      score: 300,
      reasons: ['站点直达']
    };
    render(view, [latestSuggestion], {
      query: 'code.0ht',
      updateKind: 'highlight'
    });
    expect(items[0]).toBe(row);
    expect(items[0]._xSuggestion).toBe(latestSuggestion);
    expect(applyThemeVariables).not.toHaveBeenCalled();
    expect(attachFaviconWithFallbacks).not.toHaveBeenCalled();
    expect(bindCursorTooltip).not.toHaveBeenCalled();
    expect(getThemeForSuggestion).not.toHaveBeenCalled();

    act(() => {
      row.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0
      }));
    });
    expect(onActivateSuggestion).toHaveBeenLastCalledWith(
      latestSuggestion,
      'code.0ht',
      expect.any(MouseEvent),
      0,
      row
    );
  });

  it('keeps existing row nodes when a remote result is inserted ahead of local results', () => {
    const { view, items } = createView();
    const firstLocal: Suggestion = {
      type: 'history',
      title: 'Example one',
      url: 'https://example.com/1'
    };
    const secondLocal: Suggestion = {
      type: 'bookmark',
      title: 'Example two',
      url: 'https://example.com/2'
    };
    render(view, [firstLocal, secondLocal]);
    const firstNode = items[0];
    const secondNode = items[1];

    render(view, [
      {
        type: 'googleSuggest',
        title: 'Example remote',
        url: 'https://search.example/?q=example'
      },
      firstLocal,
      secondLocal
    ]);

    expect(items).toHaveLength(3);
    expect(items[1]).toBe(firstNode);
    expect(items[2]).toBe(secondNode);
  });

  it('commits the primary highlight before layout effects run', () => {
    const rowStatesAtThemeApplication: Array<string | undefined> = [];
    const { view } = createView({
      applyThemeVariables: (item) => {
        rowStatesAtThemeApplication.push(item.dataset.rowState);
      }
    });

    render(view, [{
      type: 'history',
      title: 'Example',
      url: 'https://example.com/'
    }]);

    expect(rowStatesAtThemeApplication[0]).toBe('active');
  });

  it('uses a concise label for engine and site search actions', () => {
    const actionModel = {
      createSearchActionModel: () => ({
        actionTags: [{ action: 'search', keyLabel: 'Enter' }],
        visitButtonAction: 'search',
        alwaysHideVisitButton: false,
        hasActionTags: true,
        hasSwitchAction: false
      })
    };
    const { view, items } = createView({
      actionModel,
      getSearchActionLabel: () => '在 Google 中搜索',
      getSiteSearchDisplayName: () => 'GitHub',
      isAiSiteSearchProvider: () => false
    });

    render(view, [
      {
        type: 'googleSuggest',
        title: 'Engine search',
        url: 'https://google.com/search?q=example'
      },
      {
        type: 'siteSearch',
        title: 'Site search',
        url: 'https://github.com/search?q=example',
        provider: { name: 'GitHub' }
      }
    ]);

    expect(
      items.map((item) => rowPart(rowParts(item, 'suggestion-action-tag')[0], 'suggestion-action-tag__label')?.textContent)
    ).toEqual(['搜索', '搜索']);
    expect(
      items.map((item) => rowPart(item, 'suggestion-action-button__label')?.textContent)
    ).toEqual(['搜索', '搜索']);
    expect(
      items.map((item) => rowParts(item, 'suggestion-action-tag')[0].dataset.action)
    ).toEqual(['search', 'search']);
    expect(
      items.map((item) => rowParts(item, 'suggestion-action-tag')[0].querySelector(
        '.x-nt-suggestion-action-tag__key'
      ))
    ).toEqual([null, null]);
  });

  it('updates action labels without remounting rows', () => {
    const actionModel = {
      createSearchActionModel: () => ({
        actionTags: [{ action: 'openNewTab', keyLabel: 'Enter' }],
        visitButtonAction: 'openNewTab',
        alwaysHideVisitButton: false,
        hasActionTags: true,
        hasSwitchAction: false
      }),
      getModifierAdjustedAction: (
        action: string,
        modifiers: { openInCurrentTab: boolean }
      ) =>
        modifiers.openInCurrentTab && action === 'openNewTab'
          ? 'go'
          : action
    };
    const { view, items, setModifiers } = createView({ actionModel });
    render(view, [{
      type: 'history',
      title: 'Example',
      url: 'https://example.com/'
    }]);
    const row = items[0];

    setModifiers({ openInCurrentTab: true });

    expect(items[0]).toBe(row);
    expect(rowPart(items[0], 'suggestion-action-button__label')?.textContent).toBe('前往');
    expect(
      rowPart(rowParts(items[0], 'suggestion-action-tag')[0], 'suggestion-action-tag__label')?.textContent
    ).toBe('前往');
  });

  it('keeps slash command rows mounted through mouse activation', () => {
    (['newtab', 'overlay'] as const).forEach((surface) => {
      const onActivateSuggestion = vi.fn();
      const { view, items } = createView({
        onActivateSuggestion,
        ...(surface === 'overlay' ? { surface } : {})
      });
      const suggestion: Suggestion = {
        type: 'commandSettings',
        title: 'Open Lumno settings',
        commandText: '/settings'
      };

      render(view, [suggestion]);
      const row = items[0];
      let mouseDownAccepted = true;
      act(() => {
        mouseDownAccepted = row.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          cancelable: true
        }));
        row.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          button: 0
        }));
      });

      expect(mouseDownAccepted, surface).toBe(false);
      expect(onActivateSuggestion).toHaveBeenCalledWith(
        suggestion,
        'exa',
        expect.any(MouseEvent),
        0,
        row
      );
    });
  });

  it('marks the web clip command with a scissors icon and no visit button', () => {
    (['newtab', 'overlay'] as const).forEach((surface) => {
      const { view, items } = createView(surface === 'overlay' ? { surface } : {});
      render(view, [{
        type: 'commandDocumentPip',
        title: 'Clip part of this page',
        commandText: '/clip'
      }]);
      const iconSlot = items[0].querySelector('.x-nt-suggestion-icon-slot');
      expect(iconSlot?.querySelector('.ri-scissors-cut-line'), surface).not.toBeNull();
      expect(items[0].querySelector('.ri-arrow-right-line'), surface).toBeNull();
    });
  });
});
