import { act } from 'react';
import { queryHtmlElement } from '../../dom-lookup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Suggestion, SuggestionElement } from './suggestions';
import { expectTag, getElements, getTag, getTags, required } from '../../../../tests/react/dom';
import { createView, destroyViews, render, rowPart, rowParts } from '../../../../tests/react/suggestions';

afterEach(destroyViews);

describe('Suggestion rows: open tabs, utility actions and the overlay', () => {
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
    const button = expectTag(rowPart(row, 'tab-switch-button'), 'button');
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
      expectTag(rowParts(items[0], 'suggestion-utility-button').at(-1), 'button');

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
    const deleteButton = expectTag(rowParts(row, 'suggestion-utility-button').at(-1), 'button');
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
    expect(rowPart(items[0], 'suggestion-action-tags')?.dataset.visible).toBe('true');
    expect(rowPart(items[0], 'suggestion-switch-button')?.dataset.visible).toBe('false');
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
    const { view, items, select } = createView({
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
    const visitButton = expectTag(rowPart(row, 'suggestion-visit-button'), 'button');
    const historyTag = expectTag(queryHtmlElement(row, '[data-tag-type="history"]'), 'span');

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

    select(0);

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
