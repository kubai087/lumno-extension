import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as settings from '../../../src/domain/settings';
import { FakeAnimation } from '../../fakes/animation';
import { createBrowserFake, type FakeBookmark } from '../../fakes/browser';
import { getElement } from '../../fakes/dom';
import { bootReadyNewtab, waitFor } from './boot';
import { openSearchPage, pause } from './search-page';

// Work New Tab coalesces or keeps cheap: one reload for a burst of history
// changes, paging motion without paint-heavy filters, native controls in the
// resolved theme, and local results when the worker's remote suggestions fail.

const SYNC = {
  [settings.language.key]: 'en',
  [settings.recentCount.key]: 8,
  [settings.recentMode.key]: 'latest',
  [settings.motionEffectsEnabled.key]: true
};
const BOOKMARKS: FakeBookmark[] = Array.from({ length: 30 }, (_, index) => ({ id: `b${index}`, title: `B${index}`, url: `https://b${index}.example/` }));

const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');

// Web Animations, which JSDOM lacks, recorded by their keyframes.
function recordAnimations(): string[] {
  const keyframes: string[] = [];
  Element.prototype.animate = (frames: Keyframe[] | PropertyIndexedKeyframes | null) => {
    keyframes.push(JSON.stringify(frames));
    return new FakeAnimation();
  };
  return keyframes;
}

afterEach(() => {
  if (animateDescriptor) {
    Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'animate');
  }
});

describe('New Tab page work', () => {
  it('gives native controls the resolved dark theme', async () => {
    await bootReadyNewtab(createBrowserFake({ sync: SYNC }), { darkSystem: true });

    await waitFor(() => document.documentElement.style.colorScheme === 'dark', 'native controls did not follow the dark theme');
  });

  it('reloads the recent sites once for a burst of visits elsewhere', async () => {
    const browser = createBrowserFake({
      sync: SYNC,
      history: [{ url: 'https://a.example/', title: 'A', lastVisitTime: Date.now(), visitCount: 2 }]
    });
    const searches = vi.spyOn(browser.history, 'search');
    await bootReadyNewtab(browser);
    await pause(300);
    const loads = searches.mock.calls.length;

    await act(async () => {
      for (let index = 0; index < 5; index += 1) {
        browser.history.onVisited.fire({ url: `https://visit-${index}.example/` });
      }
    });
    await pause(400);

    expect(searches.mock.calls.length - loads).toBe(1);
  });

  it('pages the bookmarks with transform and opacity only', async () => {
    const keyframes = recordAnimations();
    await bootReadyNewtab(createBrowserFake({ sync: SYNC, bookmarksBar: BOOKMARKS }));
    await waitFor(() => document.querySelector('.x-nt-bookmarks-pager-btn[aria-label="Next page"]') !== null, 'the bookmarks have no next page');
    keyframes.length = 0;

    await act(async () => getElement(document, '.x-nt-bookmarks-pager-btn[aria-label="Next page"]').click());
    await pause(300);

    expect(keyframes.length).toBeGreaterThan(0);
    expect(keyframes.filter((frames) => /filter|blur\(/.test(frames))).toEqual([]);
  });

  it('keeps its local results when the extension runtime is gone for remote suggestions', async () => {
    const browser = createBrowserFake({
      sync: { [settings.language.key]: 'en', [settings.motionEffectsEnabled.key]: false },
      respond: ({ action }) => {
        if (action === 'getSearchEngineSuggestions') {
          throw new Error('Extension context invalidated.');
        }
        return action === 'getSearchSuggestions'
          ? { suggestions: [{ type: 'history', url: 'https://local.example/', title: 'Local result' }] }
          : undefined;
      }
    });
    const search = await openSearchPage(browser);

    await search.type('local');

    await search.waitForRows((rows) => rows.some((row) => (row.textContent || '').includes('Local result')), 'the local result did not show');
  });
});
