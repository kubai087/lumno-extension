import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { SURFACES, openSearchSurface, suggestionOf, type SurfaceMessage } from './surfaces';

// Both search surfaces read typed URLs, match results to open tabs and
// autocomplete the same way, through the shared rules in
// src/domain/search/utils/.

interface Row {
  type: string;
  title: string;
  url: string;
}

function respondWith(suggestions: Row[], tabs?: object[]) {
  return {
    openContext: tabs ? { tabs } : {},
    respond(message: SurfaceMessage) {
      if (message.action === 'getSearchSuggestions') return { suggestions };
      if (message.action === 'getTabsForOverlay' || message.action === 'getTabs') return { tabs: tabs || [] };
      if (message.action === 'getSearchEngineSuggestions') {
        const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
        return {
          suggestions: local.concat([{ type: 'googleSuggest', title: 'github desktop', url: 'https://www.google.com/search?q=github%20desktop' }]),
          hasRemoteSuggestions: true
        };
      }
      return undefined;
    }
  };
}

describe.each(SURFACES)('%s search navigation', (name) => {
  it.each([
    ['localhost:3000/docs', { url: 'https://localhost:3000/docs' }],
    ['example.com/docs', { url: 'https://example.com/docs' }],
    ['javascript:alert(1)', { search: 'javascript:alert(1)' }]
  ])('Enter on %s opens %j', async (query, expected) => {
    const surface = await openSearchSurface(name);
    await surface.type(query);
    await surface.settle(60);
    surface.press('Enter');
    await surface.settle(120);
    expect(surface.navigation()).toEqual(expected);
  });

  it.each([
    ['http://localhost:3000/app', true],
    ['http://localhost:4000/app', false]
  ])('matches %s to the tab open on port 3000: %s', async (url, switches) => {
    const tabs = [{ id: 7, windowId: 1, title: 'Dev 3000', url: 'http://localhost:3000/app' }];
    const surface = await openSearchSurface(name, respondWith([{ type: 'history', title: 'Dev app', url }], tabs));
    await surface.type('dev app');
    await surface.settle(150);
    const row = surface.suggestions().find((item) => /Dev app/.test(item.textContent || ''));
    expect(row).toBeDefined();
    const before = surface.messages.length;
    if (row) surface.click(row);
    await surface.settle(120);
    const switched = surface.messages.slice(before).some((message) => message.action === 'switchToTab' && message.tabId === 7);
    expect(switched).toBe(switches);
    if (!switches) {
      expect(surface.navigation()).toEqual({ url });
    }
  });

  it.each([false, true])('completes inline only from a local result (local result: %s)', async (local) => {
    const surface = await openSearchSurface(name, respondWith(local ? [{ type: 'history', title: 'GitHub', url: 'https://github.com/' }] : []));
    const input = surface.input();
    act(() => {
      input.value = 'git';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 't' }));
    });
    await surface.settle(250);
    if (local) {
      expect([input.value, input.selectionStart, input.selectionEnd]).toEqual(['github.com', 3, 10]);
    } else {
      expect(input.value).toBe('git');
      expect(suggestionOf(surface.suggestions()[0] || document.body).type).toBe('newtab');
    }
  });

  it('keeps the typed case in the inline completion', async () => {
    const surface = await openSearchSurface(name, respondWith([{ type: 'history', title: '4A广告网', url: 'https://www.4anet.com/' }]));
    const input = surface.input();
    act(() => {
      input.value = '4A';
      input.setSelectionRange(2, 2);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'A' }));
    });
    await surface.settle(250);
    expect([input.value, input.selectionStart, input.selectionEnd]).toEqual(['4Anet.com', 2, 9]);
  });
});
