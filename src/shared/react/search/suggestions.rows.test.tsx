import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { getTag } from '../../../../tests/fakes/dom';
import { queryHtmlElement } from '../../dom-lookup';
import {
  createView,
  destroyViews,
  render,
  rowPart,
  showTabs,
  showSuggestions
} from '../../../../tests/fakes/suggestions';

afterEach(destroyViews);

describe('Suggestion rows: shortcuts, tags, text and highlights', () => {
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

    expect(container.dataset.reactIsland).toBe('suggestions');
    expect(items).toHaveLength(1);
    expect(items[0]._xIsSearchSuggestion).toBe(true);
    expect(items[0]._xIsAutocompleteTop).toBe(true);
    expect(rowPart(items[0], 'suggestion-title')?.textContent).toBe('Example result');
    expect(items[0].dataset.themed).toBe('true');
    expect(items[0].dataset.rowState).toBe('active');
    expect(rowPart(items[0], 'suggestion-action-tags')?.dataset.visible).toBe('true');
    expect(rowPart(items[0], 'suggestion-visit-button')?.dataset.visible).toBe('false');
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
    const { view: passageView, select } = createView({ getHelpPassageHost: () => host });

    act(() => {
      showSuggestions(passageView, {
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

    select(0);
    expect(card()?.getAttribute('data-visible')).toBe('true');
    expect(card()?.querySelector('._x_extension_help_passage_heading_2026_unique_')?.textContent).toBe('Default shortcuts');
    expect([...(card()?.querySelectorAll('th') || [])].map((cell) => cell.textContent)).toEqual(['Action', 'Shortcut']);
    expect(card()?.querySelector('td')?.textContent).toBe('Open the command bar');
    expect(card()?.querySelector('ol')?.getAttribute('start')).toBe('2');
    expect(card()?.querySelector('mark')?.textContent?.toLowerCase()).toBe('shortcut');

    select(1);
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
    expect(items[1].querySelector('[data-tag-type="open-tab"]')?.getAttribute('data-visible')).toBe('true');
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
    expect(rowPart(items[0], 'suggestion-visit-button')?.dataset.visible).toBe('false');
    expect(rowPart(items[0], 'suggestion-visit-button')?.style.getPropertyValue(
      '--x-ov-suggestion-action-button-bg'
    )).toBe('#eee');
    expect(rowPart(items[0], 'suggestion-visit-button')?.style.getPropertyValue(
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
    expect(rowPart(items[0], 'suggestion-visit-button')?.style.getPropertyValue(
      '--x-ov-suggestion-action-button-bg'
    )).toBe('transparent');
    expect(rowPart(items[0], 'suggestion-visit-button')?.style.getPropertyValue(
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
        showTabs(view, [{
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
        showTabs(view, [{
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
      Array.from(rowPart(items[0], 'suggestion-title')?.querySelectorAll('mark') || []).map((mark) => mark.textContent)
    ).toEqual(['视频']);

    render(view, [suggestion], { query: 'shipinx' });
    expect(rowPart(items[0], 'suggestion-title')?.querySelectorAll('mark')).toHaveLength(0);
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
    expect(rowPart(items[0], 'suggestion-title')?.textContent).toBe('Когда да');
  });

  it('reports whether highlighted text belongs to the selected row', () => {
    const markStates = new Map<HTMLElement, unknown>();
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
});
