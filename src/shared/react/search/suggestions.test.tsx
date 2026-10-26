import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as suggestionActionModel from '../../../domain/search/suggestion-action-model';
import {
  createSuggestionsView,
  createSuggestionsViewApi,
  type Suggestion,
  type SuggestionElement,
  type SuggestionsViewController,
  type SuggestionsViewOptions
} from './suggestions';
import { expectTag, getElements, getTag, getTags, required } from '../../../../tests/react/dom';
import { queryHtmlElement } from '../../dom-lookup';

let views: SuggestionsViewController[] = [];
const sharedSuggestionActionModel: NonNullable<SuggestionsViewOptions['actionModel']> =
  suggestionActionModel;

function createOptions(
  overrides: Partial<SuggestionsViewOptions> = {}
): {
  options: SuggestionsViewOptions;
  container: HTMLElement;
  items: SuggestionElement[];
  getSelectedIndex: () => number;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const items: SuggestionElement[] = [];
  let selectedIndex = -1;
  const defaultTheme = {
    buttonText: '#111',
    buttonBg: '#eee',
    buttonBorder: '#ddd',
    tagBg: '#def',
    tagText: '#123',
    tagBorder: '#abc'
  };
  const actionModel = {
    ...sharedSuggestionActionModel,
    ...(overrides.actionModel || {})
  };
  const options: SuggestionsViewOptions = {
    document,
    container,
    items,
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values = {}) =>
      Object.entries(values).reduce(
        (text, [key, value]) =>
          text.replace(`{${key}}`, value),
        fallback
      ),
    getRiSvg: (name, size = '') =>
      `<i class="${name} ${size}"></i>`,
    sanitizeDisplayText: (value) => String(value || ''),
    getHostFromUrl: (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    },
    getThemeHostForSuggestion: (suggestion) => {
      try {
        return new URL(String(suggestion.url || '')).hostname;
      } catch {
        return '';
      }
    },
    getImmediateThemeForSuggestion: () => defaultTheme,
    getThemeForSuggestion: () =>
      new Promise(() => {
        // Keep async theme resolution pending for deterministic tests.
      }),
    getThemeForMode: (theme) => theme || defaultTheme,
    getHoverColors: () => ({
      bg: '#eee',
      border: '#ddd'
    }),
    getNeutralHoverActionColors: () => ({
      bg: '#f5f5f5',
      border: '#ddd',
      text: '#555'
    }),
    applyThemeVariables: (item) => {
      item.dataset.themed = 'true';
    },
    applyMarkVariables: (item) => {
      item.dataset.markThemed = 'true';
    },
    getPageFaviconRenderCandidates: (_url, favicon) => ({
      primaryUrl: favicon
    }),
    attachFaviconWithFallbacks: (image, _url, _host, candidates) => {
      image.src =
        candidates.primaryUrl ||
        'data:image/png;base64,dGVzdA==';
    },
    onSetSelectedIndex: (index) => {
      selectedIndex = index;
    },
    getSelectedIndex: () => selectedIndex,
    ...overrides,
    actionModel
  };
  return {
    options,
    container,
    items,
    getSelectedIndex: () => selectedIndex
  };
}

function createView(
  overrides: Partial<SuggestionsViewOptions> = {}
) {
  const result = createOptions(overrides);
  const view = createSuggestionsView(result.options);
  views.push(view);
  return { view, ...result };
}

function render(
  view: SuggestionsViewController,
  suggestions: Suggestion[],
  extra: Record<string, unknown> = {}
): void {
  act(() => {
    view.render({
      suggestions,
      query: 'exa',
      primaryHighlightIndex: 0,
      primaryHighlightReason: 'default',
      ...extra
    });
  });
}

afterEach(() => {
  act(() => {
    views.forEach((view) => view.destroy());
  });
  views = [];
  document.body.textContent = '';
});

describe('Suggestions React island', () => {
  it('maps visible result rows to 0-9 on both search surfaces', () => {
    (['newtab', 'overlay'] as const).forEach((surface) => {
      const { view, container } = createView({ surface });
      const className = surface === 'overlay'
        ? '.x-ov-suggestion-number-shortcut'
        : '.x-nt-suggestion-number-shortcut';
      render(
        view,
        Array.from({ length: 11 }, (_, index) => ({
          type: 'history',
          title: `Result ${index}`,
          url: `https://example.com/${index}`
        }))
      );

      expect(
        Array.from(container.querySelectorAll(className)).map(
          (badge) => badge.textContent
        )
      ).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    });
  });

  it('uses one neutral default style for common, bookmark, and history tags', () => {
    (['newtab', 'overlay'] as const).forEach((surface) => {
      const { view, items } = createView({ surface });
      render(view, [
        {
          type: 'topSite',
          title: 'Common result',
          url: 'https://common.example/'
        },
        {
          type: 'bookmark',
          title: 'Bookmark result',
          url: 'https://bookmark.example/'
        },
        {
          type: 'history',
          title: 'History result',
          url: 'https://history.example/'
        }
      ], {
        primaryHighlightIndex: -1,
        updateKind: 'structure'
      });

      const propertyPrefix = surface === 'overlay'
        ? '--x-ov-suggestion-source-tag'
        : '--x-nt-suggestion-tag';
      const tokenPrefix = surface === 'overlay' ? '--x-ov' : '--x-nt';
      const tags = items.map((item) => queryHtmlElement(item, '[data-tag-type]'));

      expect(tags.map((tag) => tag?.style.getPropertyValue(
        `${propertyPrefix}-bg`
      ))).toEqual(Array(3).fill(
        `var(${tokenPrefix}-tag-bg, #F3F4F6)`
      ));
      expect(tags.map((tag) => tag?.style.getPropertyValue(
        `${propertyPrefix}-text`
      ))).toEqual(Array(3).fill(
        `var(${tokenPrefix}-tag-text, #667085)`
      ));
      expect(tags.map((tag) => tag?.style.getPropertyValue(
        `${propertyPrefix}-border`
      ))).toEqual(Array(3).fill('transparent'));
    });
  });

  it('exposes the React API and renders legacy metadata synchronously', () => {
    const actionModel = {
      createSearchActionModel: () => ({
        actionTags: [{ action: 'search', keyLabel: 'Enter' }],
        visitButtonAction: 'openNewTab',
        alwaysHideVisitButton: false,
        hasActionTags: true,
        hasSwitchAction: false
      }),
      shouldShowVisitButton: (
        _model: unknown,
        active: boolean
      ) => !active
    };
    const { view, container, items } = createView({
      actionModel
    });

    render(view, [{
      type: 'history',
      title: 'Example result',
      url: 'https://example.com/page',
      favicon: 'data:image/png;base64,dGVzdA=='
    }]);

    expect(createSuggestionsViewApi().implementation).toBe('react');
    expect(container.dataset.reactIsland).toBe('suggestions');
    expect(items).toHaveLength(1);
    expect(items[0]._xIsSearchSuggestion).toBe(true);
    expect(items[0]._xIsAutocompleteTop).toBe(true);
    expect(items[0]._xThemeHost).toBe('example.com');
    expect(items[0]._xTitle?.textContent).toBe('Example result');
    expect(items[0].dataset.themed).toBe('true');
    expect(items[0].dataset.rowState).toBe('active');
    expect(items[0]._xTagContainer?.dataset.visible).toBe('true');
    expect(items[0]._xVisitButton?.dataset.visible).toBe('false');
    expect(
      items[0].querySelector('mark')?.textContent
    ).toBe('Exa');
  });

  it('uses the themed Overlay mark class for matched query text', () => {
    const { view, items } = createView({
      surface: 'overlay'
    });

    render(view, [{
      type: 'history',
      title: 'Example result',
      url: 'https://example.com/page'
    }]);

    expect(
      items[0].querySelector('mark')?.className
    ).toBe('x-ov-suggestion-mark');
  });

  it('shows a compact host and path while keeping noisy query parameters out of the row', () => {
    const { view, items } = createView();

    render(view, [{
      type: 'history',
      title: 'Xiaohongshu cashier',
      url: 'https://mall.xiaohongshu.com/finance/cashier/web?cashierId=123&redirectPath=%2Fexplore'
    }]);

    expect(
      items[0].querySelector('.x-nt-suggestion-url-line')?.textContent
    ).toBe('mall.xiaohongshu.com/finance/cashier/web');
  });

  it('shows the matched section of a help center page instead of its address', () => {
    const { view, items } = createView();

    render(view, [{
      type: 'helpArticle',
      title: 'Keyboard shortcuts',
      detail: 'Default shortcuts',
      url: 'https://lumno.kubai.design/en/help/keyboard-shortcuts/#defaults',
      favicon: 'chrome-extension://lumno/assets/images/site-search/tile-lm.png'
    }]);

    expect(
      items[0].querySelector('.x-nt-suggestion-url-line')?.textContent
    ).toBe('Default shortcuts');
  });

  it('lays a help center result\'s passage out in a card beside the list while it is picked', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const { view: passageView } = createView({ getHelpPassageHost: () => host });

    act(() => {
      passageView.render({
        query: 'shortcut',
        suggestions: [{
          type: 'helpArticle',
          title: 'Keyboard shortcuts',
          detail: 'Default shortcuts',
          url: 'https://lumno.kubai.design/en/help/keyboard-shortcuts/#defaults',
          context: [
            { kind: 'heading', text: 'Default shortcuts' },
            { kind: 'row', cells: ['Action', 'Shortcut'], header: true },
            { kind: 'row', cells: ['Open the command bar', '⌘ ⇧ K'] },
            { kind: 'step', marker: '2.', text: 'Click the shortcut field.' }
          ]
        }, {
          type: 'history',
          title: 'Example',
          url: 'https://example.com/'
        }]
      });
    });
    const card = () => queryHtmlElement(host, '._x_extension_help_passage_2026_unique_');
    expect(card()).toBeNull();

    act(() => passageView.updateSelection(0));
    expect(card()?.getAttribute('data-visible')).toBe('true');
    expect(card()?.querySelector('._x_extension_help_passage_heading_2026_unique_')?.textContent).toBe('Default shortcuts');
    expect([...(card()?.querySelectorAll('th') || [])].map((cell) => cell.textContent)).toEqual(['Action', 'Shortcut']);
    expect(card()?.querySelector('td')?.textContent).toBe('Open the command bar');
    expect(card()?.querySelector('ol')?.getAttribute('start')).toBe('2');
    expect(card()?.querySelector('mark')?.textContent?.toLowerCase()).toBe('shortcut');

    act(() => passageView.updateSelection(1));
    expect(card()?.getAttribute('data-visible')).toBe('false');
  });

  it('keeps a non-primary matching open tab visibly switchable', () => {
    const { view, items } = createView({
      surface: 'overlay',
      shouldSwitchMatchedTabSuggestion: (suggestion) =>
        typeof suggestion._xMatchedTabId === 'number'
    });

    render(view, [
      {
        type: 'topSite',
        title: '小红书',
        url: 'https://www.xiaohongshu.com/'
      },
      {
        type: 'history',
        title: '小红书 - 你的生活兴趣社区',
        url: 'https://www.xiaohongshu.com/explore/6a4dcb39000000001',
        _xMatchedTabId: 26
      }
    ], {
      primaryHighlightIndex: 0,
      primaryHighlightReason: 'navigation'
    });

    expect(items[1]._xVisitButtonAction).toBe('switch');
    expect(items[1]._xHasSwitchAction).toBe(true);
    expect(
      items[1].querySelector('[data-tag-type="open-tab"]')?.textContent
    ).toBe('已打开');
  });

  it('switches decorative search-row treatment only when simple mode is enabled', () => {
    let simpleModeEnabled = true;
    const { view, items } = createView({
      surface: 'overlay',
      isSimpleModeEnabled: () => simpleModeEnabled,
      getUrlDisplay: (url) => url
        .replace(/^https?:\/\/(?:www\.)?/i, '')
    });
    const suggestions = [{
      type: 'history',
      title: 'Example result',
      url: 'https://www.example.com/page'
    }];

    render(view, suggestions, {
      primaryHighlightReason: 'autocomplete'
    });

    expect(items[0].dataset.simpleMode).toBe('true');
    expect(items[0].querySelector('mark')).toBeNull();
    expect(
      items[0].querySelector('.x-ov-suggestion-url-line')?.textContent
    ).toBe('example.com/page');
    expect(
      items[0].querySelector('[data-tag-type="history"]')
    ).toBeNull();
    expect(items[0].querySelector('.x-ov-action-tag__key')).toBeNull();
    expect(items[0]._xVisitButton?.dataset.visible).toBe('false');
    expect(items[0]._xVisitButton?.style.getPropertyValue(
      '--x-ov-suggestion-action-button-bg'
    )).toBe('#eee');
    expect(items[0]._xVisitButton?.style.getPropertyValue(
      '--x-ov-suggestion-action-button-border'
    )).toBe('#ddd');
    expect(
      items[0].style.getPropertyValue('--x-ov-suggestion-row-bg')
    ).toBe('var(--x-ov-hover-bg, #F3F4F6)');

    const utilityButton = getTag(items[0], '.x-ov-suggestion-utility-button', 'button');
    act(() => {
      items[0].dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
      utilityButton.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
    });
    expect(utilityButton.dataset.visible).toBe('true');
    expect(utilityButton.style.getPropertyValue(
      '--x-ov-suggestion-utility-color'
    )).toBe('var(--x-ov-subtext, #6B7280)');
    expect(utilityButton.style.getPropertyValue(
      '--x-ov-suggestion-utility-bg'
    )).toBe('transparent');
    expect(utilityButton.style.getPropertyValue(
      '--x-ov-suggestion-utility-border'
    )).toBe('transparent');
    expect(utilityButton.style.getPropertyValue(
      '--x-ov-suggestion-utility-hover-bg'
    )).toBe('#f5f5f5');
    expect(utilityButton.style.getPropertyValue(
      '--x-ov-suggestion-utility-hover-color'
    )).toBe('#555');

    simpleModeEnabled = false;
    render(view, suggestions, {
      primaryHighlightReason: 'autocomplete',
      updateKind: 'highlight'
    });

    expect(items[0].dataset.simpleMode).toBe('false');
    expect(items[0].querySelector('mark')?.textContent).toBe('Exa');
    expect(
      items[0].querySelector('[data-tag-type="history"]')
        ?.getAttribute('data-visible')
    ).toBe('true');
    expect(items[0].querySelector('.x-ov-action-tag__key')).toBeNull();
    expect(items[0]._xVisitButton?.style.getPropertyValue(
      '--x-ov-suggestion-action-button-bg'
    )).toBe('transparent');
    expect(items[0]._xVisitButton?.style.getPropertyValue(
      '--x-ov-suggestion-action-button-border'
    )).toBe('transparent');
  });

  it('removes trailing result arrows outside simple mode on both search surfaces', () => {
    (['newtab', 'overlay'] as const).forEach((surface) => {
      let simpleModeEnabled = false;
      const { view, items } = createView({
        surface,
        isSimpleModeEnabled: () => simpleModeEnabled
      });

      render(view, [{
        type: 'history',
        title: 'Example result',
        url: 'https://example.com/'
      }]);
      expect(
        items[0].querySelector('.ri-arrow-right-line'),
        `${surface} search result`
      ).toBeNull();

      act(() => {
        view.renderTabs([{
          id: 42,
          title: 'Example tab',
          url: 'https://example.com/tab'
        }]);
      });
      expect(
        items[0].querySelector('.ri-arrow-right-line'),
        `${surface} open-tab result`
      ).toBeNull();

      simpleModeEnabled = true;
      act(() => {
        view.renderTabs([{
          id: 42,
          title: 'Example tab',
          url: 'https://example.com/tab'
        }]);
      });
      expect(
        items[0].querySelector('.ri-arrow-right-line'),
        `${surface} simple-mode open-tab result`
      ).not.toBeNull();
    });
  });

  it('highlights separate query terms in both the title and URL', () => {
    const { view, items } = createView();

    render(view, [{
      type: 'history',
      title: 'Codex workspace',
      url: 'https://example.com/最爱'
    }], {
      query: 'codex 最爱'
    });

    expect(
      Array.from(items[0].querySelectorAll('mark')).map((mark) =>
        mark.textContent
      )
    ).toEqual(['Codex', '最爱']);
  });

  it('marks the title characters a pinyin match spelled while its query is current', () => {
    const { view, items } = createView();
    const suggestion = {
      type: 'history',
      title: '腾讯视频 - 中国领先的在线视频平台',
      url: 'https://v.qq.com/',
      titleHighlight: {
        text: '腾讯视频 - 中国领先的在线视频平台',
        query: 'shipin',
        ranges: [[2, 4]] satisfies Array<[number, number]>
      }
    };

    render(view, [suggestion], { query: 'ShiPin' });
    expect(
      Array.from(items[0]._xTitle?.querySelectorAll('mark') || []).map((mark) => mark.textContent)
    ).toEqual(['视频']);

    render(view, [suggestion], { query: 'shipinx' });
    expect(items[0]._xTitle?.querySelectorAll('mark')).toHaveLength(0);
  });

  it('marks a short typed term only where a word starts', () => {
    const { view, items } = createView();

    render(view, [{
      type: 'history',
      title: 'Detail of OpenAI',
      url: 'https://example.com/detail'
    }], {
      query: 'ai'
    });

    expect(
      Array.from(items[0].querySelectorAll('mark')).map((mark) => mark.textContent)
    ).toEqual(['AI']);
  });

  it('marks a short Cyrillic term only where a word starts', () => {
    const { view, items } = createView();

    render(view, [{
      type: 'history',
      title: 'Когда да',
      url: 'https://example.com/ru'
    }], {
      query: 'да'
    });

    expect(
      Array.from(items[0].querySelectorAll('mark')).map((mark) => mark.textContent)
    ).toEqual(['да']);
    expect(items[0]._xTitle?.textContent).toBe('Когда да');
  });

  it('reports whether highlighted text belongs to the selected row', () => {
    const markStates = new Map<SuggestionElement, unknown>();
    const { view, items } = createView({
      applyMarkVariables: (item, _theme, active) => {
        markStates.set(item, active);
      }
    });

    render(view, [
      {
        type: 'history',
        title: 'Example selected',
        url: 'https://example.com/selected'
      },
      {
        type: 'history',
        title: 'Example passive',
        url: 'https://example.com/passive'
      }
    ]);

    expect(markStates.get(items[0])).toBe(true);
    expect(markStates.get(items[1])).toBe(false);
  });

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

  it('binds a clipped title tooltip to the whole row', () => {
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
    const boundToRow = bindCursorTooltip.mock.calls.filter(
      ([target]) => target === row
    );
    expect(boundToRow).toHaveLength(1);
    const [, getText] = boundToRow[0];
    expect(getText()).toBe('Example result');
  });

  it('updates only the matching mark when result content is unchanged', () => {
    const bindCursorTooltip = vi.fn();
    const onSetSelectedIndex = vi.fn();
    const { view, items } = createView({
      bindCursorTooltip,
      onSetSelectedIndex
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
      onSetSelectedIndex
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
      items.map((item) => item._xActionTags?.[0]._xActionLabel?.textContent)
    ).toEqual(['搜索', '搜索']);
    expect(
      items.map((item) => item._xVisitButtonLabel?.textContent)
    ).toEqual(['搜索', '搜索']);
    expect(
      items.map((item) => item._xActionTags?.[0].dataset.action)
    ).toEqual(['search', 'search']);
    expect(
      items.map((item) => item._xActionTags?.[0].querySelector(
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
    const { view, items } = createView({ actionModel });
    render(view, [{
      type: 'history',
      title: 'Example',
      url: 'https://example.com/'
    }]);
    const row = items[0];

    act(() => {
      view.setOpenInCurrentTabModifierActive(true);
    });

    expect(items[0]).toBe(row);
    expect(items[0]._xVisitButtonLabel?.textContent).toBe('前往');
    expect(
      items[0]._xActionTags?.[0]._xActionLabel?.textContent
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

  it('renders open tabs and preserves click and middle-click activation', () => {
    const onSwitchToTab = vi.fn();
    const onCopyUrl = vi.fn();
    const setSuggestionsVisible = vi.fn();
    const preloadIcon = vi.fn();
    const { view, items } = createView({
      onSwitchToTab,
      onCopyUrl,
      setSuggestionsVisible,
      preloadIcon
    });

    act(() => {
      view.renderTabs([{
        id: 42,
        title: 'Example tab',
        url: 'https://example.com/',
        favIconUrl: 'data:image/png;base64,dGVzdA=='
      }]);
    });
    const row = items[0];
    const button = expectTag(row._xSwitchButton, 'button');
    const copyButton = getTag(row, '.x-nt-suggestion-utility-button', 'button');
    act(() => {
      row.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
      button.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0
      }));
      row.dispatchEvent(new MouseEvent('auxclick', {
        bubbles: true,
        button: 1
      }));
      copyButton.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      }));
    });

    expect(items).toHaveLength(1);
    expect(items[0]._xIsSearchSuggestion).toBe(false);
    expect(preloadIcon).toHaveBeenCalledOnce();
    // The page URL lets the favicon policy apply its path-specific exclusions.
    expect(preloadIcon).toHaveBeenCalledWith('data:image/png;base64,dGVzdA==', 'https://example.com/');
    expect(onSwitchToTab).toHaveBeenCalledTimes(2);
    expect(onCopyUrl).toHaveBeenCalledWith('https://example.com/');
    expect(setSuggestionsVisible).toHaveBeenLastCalledWith(true);
  });

  it('refreshes open-tab theme variables after async brand resolution', async () => {
    const fallbackTheme = {
      tagBg: 'rgb(210, 224, 246)',
      tagText: '#111827'
    };
    const brandTheme = {
      _xIsBrand: true,
      highlightBg: 'rgb(250, 230, 248)',
      tagBg: 'rgb(248, 217, 244)',
      tagText: '#111827'
    };
    let resolveAsyncTheme: ((theme: typeof brandTheme) => void) | null = null;
    const asyncTheme = new Promise<typeof brandTheme>((resolve) => {
      resolveAsyncTheme = resolve;
    });
    const applyThemeVariables = vi.fn((
      item: SuggestionElement,
      theme: Record<string, unknown> | null
    ) => {
      item.style.setProperty(
        '--x-ext-tag-bg',
        String(theme?.tagBg || '')
      );
      item.style.setProperty(
        '--x-ext-tag-text',
        String(theme?.tagText || '')
      );
    });
    const { view, items } = createView({
      surface: 'overlay',
      autoHighlightFirstTab: true,
      getImmediateThemeForSuggestion: () => fallbackTheme,
      getThemeForSuggestion: () => asyncTheme,
      getThemeForMode: (theme) => theme || fallbackTheme,
      getHighlightColors: (theme) => ({
        bg: String(theme?.highlightBg || '')
      }),
      applyThemeVariables
    });

    act(() => {
      view.renderTabs([{
        id: 42,
        title: 'Dribbble',
        url: 'https://dribbble.com/',
        favIconUrl: 'https://dribbble.com/favicon.ico'
      }]);
    });
    const row = items[0];
    expect(row.querySelector('.x-ov-action-tag')?.textContent)
      .toBe('切换');
    expect(row.style.getPropertyValue('--x-ext-tag-bg'))
      .toBe(fallbackTheme.tagBg);

    await act(async () => {
      resolveAsyncTheme?.(brandTheme);
      await asyncTheme;
    });

    expect(items[0]).toBe(row);
    expect(row._xTheme).toBe(brandTheme);
    expect(row.style.getPropertyValue('--x-ext-tag-bg'))
      .toBe(brandTheme.tagBg);
    expect(applyThemeVariables).toHaveBeenCalledTimes(2);
    expect(applyThemeVariables).toHaveBeenLastCalledWith(row, brandTheme);
  });

  it('keeps large open-tab mounts off animation frames and cancels stale idle batches', () => {
    let nextIdleId = 1;
    const idleCallbacks = new Map<number, IdleRequestCallback>();
    const requestIdle = vi.fn((callback: IdleRequestCallback) => {
      const idleId = nextIdleId++;
      idleCallbacks.set(idleId, callback);
      return idleId;
    });
    const cancelIdle = vi.fn((idleId: number) => {
      idleCallbacks.delete(idleId);
    });
    vi.stubGlobal('requestIdleCallback', requestIdle);
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame');
    const { view, items } = createView({
      openTabSuggestionLimit: 1000,
      openTabInitialRenderLimit: 3,
      openTabRenderBatchSize: 2
    });
    const tabs = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      title: `Tab ${index + 1}`,
      url: `https://example.com/${index + 1}`
    }));

    act(() => view.renderTabs(tabs));
    expect(items).toHaveLength(3);
    expect(requestIdle).toHaveBeenCalledOnce();
    expect(requestFrame).not.toHaveBeenCalled();

    const firstIdleTask = idleCallbacks.entries().next().value;
    expect(firstIdleTask).toBeDefined();
    idleCallbacks.delete(required(firstIdleTask, 'firstIdleTask')[0]);
    act(() => required(firstIdleTask, 'firstIdleTask')[1]({
      didTimeout: false,
      timeRemaining: () => 8
    }));
    expect(items).toHaveLength(5);

    act(() => view.renderTabs([tabs[0]]));
    expect(items).toHaveLength(1);
    expect(cancelIdle).toHaveBeenCalled();
    expect(idleCallbacks.size).toBe(0);

    requestFrame.mockRestore();
    vi.unstubAllGlobals();
  });

  it('reads the current visible-result limit for every initial open-tab render', () => {
    let visibleResultLimit = 5;
    const { view, items } = createView({
      openTabSuggestionLimit: 1000,
      openTabInitialRenderLimit: 10,
      getOpenTabInitialRenderLimit: () => visibleResultLimit,
      openTabRenderBatchSize: 2
    });
    const tabs = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Tab ${index + 1}`,
      url: `https://example.com/${index + 1}`
    }));

    act(() => view.renderTabs(tabs));
    expect(items).toHaveLength(5);

    visibleResultLimit = 8;
    act(() => view.renderTabs(tabs));
    expect(items).toHaveLength(8);
  });

  it('reads the current batch size when each deferred open-tab batch runs', () => {
    let nextIdleId = 1;
    let batchSize = 2;
    const idleCallbacks = new Map<number, IdleRequestCallback>();
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      const idleId = nextIdleId++;
      idleCallbacks.set(idleId, callback);
      return idleId;
    });
    vi.stubGlobal('cancelIdleCallback', (idleId: number) => {
      idleCallbacks.delete(idleId);
    });
    const { view, items } = createView({
      openTabSuggestionLimit: 1000,
      openTabInitialRenderLimit: 2,
      openTabRenderBatchSize: 3,
      getOpenTabRenderBatchSize: () => batchSize
    });
    const tabs = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Tab ${index + 1}`,
      url: `https://example.com/${index + 1}`
    }));
    const runNextIdleBatch = () => {
      const idleTask = idleCallbacks.entries().next().value;
      expect(idleTask).toBeDefined();
      idleCallbacks.delete(required(idleTask, 'idleTask')[0]);
      act(() => required(idleTask, 'idleTask')[1]({
        didTimeout: false,
        timeRemaining: () => 8
      }));
    };

    act(() => view.renderTabs(tabs));
    expect(items).toHaveLength(2);
    runNextIdleBatch();
    expect(items).toHaveLength(4);

    batchSize = 4;
    runNextIdleBatch();
    expect(items).toHaveLength(8);

    act(() => view.destroy());
    vi.unstubAllGlobals();
  });

  it('keeps history deletion isolated from row activation', () => {
    const onActivateSuggestion = vi.fn();
    const onDeleteHistory = vi.fn();
    const { view, items } = createView({
      onActivateSuggestion,
      onDeleteHistory
    });
    const suggestion: Suggestion = {
      type: 'history',
      title: 'Example',
      url: 'https://example.com/'
    };
    render(view, [suggestion]);
    const button =
      expectTag(items[0]._xHistoryDeleteButton, 'button');

    act(() => {
      button.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      }));
    });

    expect(onDeleteHistory).toHaveBeenCalledWith(
      suggestion,
      'exa'
    );
    expect(onActivateSuggestion).not.toHaveBeenCalled();
  });

  it('copies a result URL without activating or deleting the row', () => {
    const onActivateSuggestion = vi.fn();
    const onDeleteHistory = vi.fn();
    const onCopyUrl = vi.fn();
    const showTopActionTooltip = vi.fn();
    const hideTopActionTooltip = vi.fn();
    const { view, items } = createView({
      onActivateSuggestion,
      onDeleteHistory,
      onCopyUrl,
      showTopActionTooltip,
      hideTopActionTooltip
    });
    const suggestion: Suggestion = {
      type: 'history',
      title: 'Example',
      url: 'https://example.com/path'
    };
    render(view, [suggestion]);
    const row = items[0];
    const utilityButtons = getTags(row, '.x-nt-suggestion-utility-button', 'button');
    const copyButton = utilityButtons[0];
    const deleteButton = expectTag(row._xHistoryDeleteButton, 'button');
    const utilitySlots = Array.from(getElements(row, '.x-nt-suggestion-utility-slot'));

    expect(utilitySlots.map((slot) => slot.dataset.leading)).toEqual([
      'true',
      undefined
    ]);

    act(() => {
      row.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
    });

    expect(showTopActionTooltip).not.toHaveBeenCalled();
    [copyButton, deleteButton].forEach((button) => {
      expect(button.style.getPropertyValue(
        '--x-nt-suggestion-utility-bg'
      )).toBe('transparent');
      expect(button.style.getPropertyValue(
        '--x-nt-suggestion-utility-border'
      )).toBe('transparent');
      expect(button.dataset.hover).toBeUndefined();
    });

    act(() => {
      copyButton.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
    });

    expect(copyButton.dataset.hover).toBe('true');
    expect(deleteButton.dataset.hover).toBeUndefined();
    expect(showTopActionTooltip).toHaveBeenLastCalledWith(
      copyButton,
      '复制链接'
    );

    act(() => {
      copyButton.dispatchEvent(new MouseEvent('mouseout', {
        bubbles: true
      }));
      deleteButton.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
    });

    expect(copyButton.dataset.hover).toBeUndefined();
    expect(deleteButton.dataset.hover).toBe('true');
    expect(hideTopActionTooltip).toHaveBeenCalled();
    expect(showTopActionTooltip).toHaveBeenLastCalledWith(
      deleteButton,
      '移除该历史'
    );

    act(() => {
      deleteButton.dispatchEvent(new MouseEvent('mouseout', {
        bubbles: true
      }));
    });

    expect(deleteButton.dataset.hover).toBeUndefined();

    act(() => {
      row.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
      copyButton.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      }));
    });

    expect(onCopyUrl).toHaveBeenCalledWith('https://example.com/path');
    expect(onActivateSuggestion).not.toHaveBeenCalled();
    expect(onDeleteHistory).not.toHaveBeenCalled();
    expect(utilityButtons).toHaveLength(2);
    expect(copyButton.className).toBe(deleteButton.className);
    expect(copyButton.dataset.visible).toBe('true');
    expect(deleteButton.dataset.visible).toBe('true');
    expect(copyButton.getAttribute('aria-label')).toBe('复制链接');
    [
      '--x-nt-suggestion-utility-color',
      '--x-nt-suggestion-utility-bg',
      '--x-nt-suggestion-utility-border'
    ].forEach((property) => {
      expect(copyButton.style.getPropertyValue(property)).toBe(
        deleteButton.style.getPropertyValue(property)
      );
    });
    expect(copyButton.compareDocumentPosition(deleteButton))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders copy only for result rows with a URL', () => {
    const { view, container } = createView();

    render(view, [{
      type: 'commandSettings',
      title: 'Settings',
      commandText: '/settings'
    }]);
    expect(container.querySelector('.x-nt-suggestion-utility-button'))
      .toBeNull();

    render(view, [{
      type: 'bookmark',
      title: 'Example',
      url: 'https://example.com/'
    }]);
    expect(container.querySelector('.x-nt-suggestion-utility-button'))
      .toBeInstanceOf(HTMLButtonElement);
  });

  it('renders empty state and clears external selection state', () => {
    const setSuggestionsVisible = vi.fn();
    const { view, container, items, getSelectedIndex } =
      createView({ setSuggestionsVisible });

    act(() => {
      view.render({
        suggestions: [],
        emptyMessage: 'No results'
      });
    });
    expect(container.querySelector('.x-nt-empty-state')?.textContent)
      .toContain('No results');
    expect(items).toHaveLength(0);
    expect(getSelectedIndex()).toBe(-1);
    expect(setSuggestionsVisible).toHaveBeenLastCalledWith(true);

    act(() => {
      view.clear();
    });
    expect(container.childElementCount).toBe(0);
    expect(setSuggestionsVisible).toHaveBeenLastCalledWith(false);
  });

  it('maps shared rows onto the Overlay class and state contract', () => {
    const { view, container, items } = createView({
      surface: 'overlay',
      enterAction: 'openNewTab',
      autoHighlightFirstTab: true,
      getHighlightColors: () => ({
        bg: '#eef',
        border: '#bbf'
      }),
      actionModel: {
        createSearchActionModel: () => ({
          actionTags: [{
            action: 'openNewTab',
            keyLabel: 'Enter'
          }],
          visitButtonAction: 'openNewTab',
          alwaysHideVisitButton: false,
          hasActionTags: true,
          hasSwitchAction: false
        })
      }
    });

    render(view, [{
      type: 'history',
      title: 'Overlay result',
      url: 'https://example.com/'
    }]);

    expect(container.dataset.reactIsland).toBe('suggestions');
    expect(items[0].className).toBe('x-ov-suggestion-item');
    expect(items[0].id).toBe(
      '_x_extension_suggestion_item_0_2024_unique_'
    );
    expect(items[0].style.getPropertyValue(
      '--x-ov-suggestion-row-bg'
    )).toBe('#eef');
    expect(
      items[0].querySelector('.x-ov-suggestion-source-tag')
    ).not.toBeNull();
    expect(
      items[0].querySelector('.x-ov-action-tag__label')
    ).not.toBeNull();
    expect(
      items[0].querySelector('.x-ov-action-tag__key')
    ).toBeNull();
    expect(
      items[0].querySelector('.x-ov-suggestion-utility-button')
    ).not.toBeNull();

    act(() => {
      view.renderTabs([{
        id: 9,
        title: 'Overlay tab',
        url: 'https://example.com/tab'
      }]);
    });
    expect(items[0]._xIsAutocompleteTop).toBe(true);
    expect(items[0]._xTagContainer?.dataset.visible).toBe('true');
    expect(items[0]._xSwitchButton?.dataset.visible).toBe('false');
    expect(items[0].querySelector('.x-ov-action-tag__key')).toBeNull();
  });

  it('leaves an open-tab row alone when the same tabs render again', () => {
    const applyThemeVariables = vi.fn();
    // The page hands out cached theme objects, the same one for the same site.
    const theme = { highlightBg: '#eef' };
    const { view } = createView({
      surface: 'overlay',
      applyThemeVariables,
      getImmediateThemeForSuggestion: () => theme
    });
    const tabs = [{ id: 1, title: 'First tab', url: 'https://example.com/first' }];

    act(() => view.renderTabs(tabs));
    const applied = applyThemeVariables.mock.calls.length;
    // The page passes a fresh list of tab objects on every update.
    act(() => view.renderTabs(tabs.map((tab) => ({ ...tab }))));
    expect(applyThemeVariables.mock.calls.length).toBe(applied);
  });

  it('moves the autocomplete mark with the first open tab when the tabs reorder', () => {
    const { view, items } = createView({
      surface: 'overlay',
      autoHighlightFirstTab: true
    });
    const first = { id: 1, title: 'First tab', url: 'https://example.com/first' };
    const second = { id: 2, title: 'Second tab', url: 'https://example.com/second' };

    act(() => view.renderTabs([first, second]));
    const [firstRow, secondRow] = items;
    expect([firstRow._xIsAutocompleteTop, secondRow._xIsAutocompleteTop]).toEqual([true, false]);

    act(() => view.renderTabs([second, first]));
    expect(items[0]).toBe(secondRow);
    expect([secondRow._xIsAutocompleteTop, firstRow._xIsAutocompleteTop]).toEqual([true, false]);
  });

  it('applies contrast-aware brand text without a tag surface', () => {
    const brandTheme = {
      _xIsBrand: true,
      accent: '#14532d',
      buttonText: '#14532d',
      buttonBg: '#dcfce7',
      buttonBorder: '#86efac',
      tagBg: '#dcfce7',
      tagText: '#166534',
      tagBorder: '#86efac',
      markBg: '#bbf7d0',
      markText: '#14532d'
    };
    const markThemes: unknown[] = [];
    const { view, items } = createView({
      surface: 'overlay',
      getImmediateThemeForSuggestion: () => brandTheme,
      getThemeForMode: (theme) => theme || brandTheme,
      getHoverColors: () => ({
        bg: '#f0fdf4',
        border: '#86efac',
        text: '#166534'
      }),
      applyMarkVariables: (item, theme, active) => {
        markThemes.push(theme);
        item.style.setProperty(
          '--x-ext-mark-bg',
          active ? '#86efac' : theme?.markBg || ''
        );
        item.style.setProperty(
          '--x-ext-mark-text',
          theme?.markText || ''
        );
      },
      actionModel: {
        createSearchActionModel: () => ({
          actionTags: [],
          visitButtonAction: 'openNewTab',
          alwaysHideVisitButton: false,
          hasActionTags: false,
          hasSwitchAction: false
        })
      }
    });

    render(view, [{
      type: 'history',
      title: 'Example result',
      url: 'https://example.com/'
    }], {
      primaryHighlightIndex: -1,
      updateKind: 'structure'
    });

    const row = items[0];
    const visitButton = expectTag(row._xVisitButton, 'button');
    const historyTag = expectTag(row._xHistoryTag, 'span');

    expect(row.style.getPropertyValue('--x-ext-mark-bg')).toBe(
      'var(--x-ov-neutral-mark-bg, #E5E7EB)'
    );
    expect(row.style.getPropertyValue('--x-ext-mark-text')).toBe(
      'var(--x-ov-neutral-mark-text, #111827)'
    );

    act(() => {
      row.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true
      }));
    });

    expect(row.dataset.rowState).toBe('hover');
    expect(row.style.getPropertyValue('--x-ov-suggestion-row-bg'))
      .toBe('#f0fdf4');
    expect(row.style.getPropertyValue('--x-ext-mark-bg'))
      .toBe('#bbf7d0');
    expect(row.style.getPropertyValue('--x-ext-mark-text'))
      .toBe('#14532d');
    expect(historyTag.style.getPropertyValue(
      '--x-ov-suggestion-source-tag-bg'
    )).toBe('transparent');
    expect(historyTag.style.getPropertyValue(
      '--x-ov-suggestion-source-tag-text'
    )).toBe('#166534');
    expect(historyTag.style.getPropertyValue(
      '--x-ov-suggestion-source-tag-border'
    )).toBe('transparent');
    expect(visitButton.style.getPropertyValue(
      '--x-ov-suggestion-action-button-bg'
    )).toBe('transparent');
    expect(visitButton.style.getPropertyValue(
      '--x-ov-suggestion-action-button-border'
    )).toBe('transparent');
    expect(visitButton.style.getPropertyValue(
      '--x-ov-suggestion-action-button-text'
    )).toBe('#14532d');
    expect(markThemes[markThemes.length - 1]).toBe(brandTheme);

    act(() => {
      view.updateSelection(0);
    });

    expect(row.dataset.rowState).toBe('active');
    expect(row.style.getPropertyValue('--x-ext-mark-bg'))
      .toBe('#86efac');
    expect(row.style.getPropertyValue('--x-ext-mark-text'))
      .toBe('#14532d');
    expect(historyTag.style.getPropertyValue(
      '--x-ov-suggestion-source-tag-bg'
    )).toBe('transparent');
    expect(historyTag.style.getPropertyValue(
      '--x-ov-suggestion-source-tag-text'
    )).toBe('#14532d');
    expect(historyTag.style.getPropertyValue(
      '--x-ov-suggestion-source-tag-border'
    )).toBe('transparent');
  });
});
