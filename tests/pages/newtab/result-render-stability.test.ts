import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { searchResultPriority } from '../../../src/domain/settings/search';
import { openSearchSurface, suggestionOf, type SurfaceMessage } from '../search/surfaces';

// What the New Tab result list shows over time while answers come in: each
// distinct list of rows, as types (with #tabId for a row that switches). How
// a list update is classified is unit-tested beside
// src/domain/search/suggestion-action-model.ts.

const TABS = [{ id: 7, windowId: 1, title: 'Dev app', url: 'http://localhost:3000/app' }];
const later = <T>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

async function framesWhileTyping(query: string, { localMs, priority }: { localMs: number; priority?: string }) {
  const surface = await openSearchSurface('newtab', {
    settings: priority ? { [searchResultPriority.key]: priority } : {},
    respond(message: SurfaceMessage) {
      if (message.action === 'getTabsForOverlay') return { tabs: TABS };
      if (message.action === 'getSearchSuggestions') {
        return later({ suggestions: [{ type: 'history', title: `Local ${String(message.query)}`, url: 'https://local.test/' }] }, localMs);
      }
      if (message.action === 'getSearchEngineSuggestions') {
        const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
        return later({
          suggestions: local.concat([{ type: 'googleSuggest', title: `${String(message.query)} x`, url: 'https://www.google.com/search?q=x' }]),
          hasRemoteSuggestions: true
        }, 200);
      }
      return undefined;
    }
  });
  await surface.settle(150);
  const tabsAskedBeforeTyping = surface.messages.some((message) => message.action === 'getTabsForOverlay');
  const frames: string[] = [];
  const snapshot = () => {
    const rows = surface.suggestions().map((row) => {
      const suggestion = suggestionOf(row);
      return `${String(suggestion.type)}${suggestion._xMatchedTabId ? `#${String(suggestion._xMatchedTabId)}` : ''}`;
    }).join(',');
    if (frames[frames.length - 1] !== rows) frames.push(rows);
  };
  const observer = new MutationObserver(snapshot);
  observer.observe(document, { subtree: true, childList: true, attributes: true });
  const input = surface.input();
  act(() => {
    input.value = query;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  });
  await surface.settle(900);
  observer.disconnect();
  return { frames: frames.filter(Boolean), tabsAskedBeforeTyping };
}

describe('New Tab results while answers come in', () => {
  it('loads the open tabs first and shows a typed open URL as its switch row at once', async () => {
    const matched = await framesWhileTyping('localhost:3000/app', { localMs: 300 });
    expect(matched.tabsAskedBeforeTyping).toBe(true);
    expect(matched.frames[0]).toBe('directUrl#7,newtab');
  });

  it('does not flash the URL row on its own when local results come quickly', async () => {
    const fast = await framesWhileTyping('example.com/docs', { localMs: 30 });
    expect(fast.frames[0]).toBe('directUrl,newtab,history');
  });

  it('shows the URL row first and keeps its place when local results are slow', async () => {
    const slow = await framesWhileTyping('example.com/docs', { localMs: 600 });
    expect(slow.frames.slice(0, 2)).toEqual(['directUrl,newtab', 'directUrl,newtab,history']);
  });

  it('does not flash local results before the search suggestions when search comes first', async () => {
    const searchFirst = await framesWhileTyping('cats', { localMs: 50, priority: 'search' });
    const firstLocal = searchFirst.frames.findIndex((frame) => frame.includes('history'));
    expect(firstLocal).toBeGreaterThan(0);
    expect(searchFirst.frames[firstLocal]).toContain('googleSuggest');
  });
});
