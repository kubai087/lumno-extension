import { describe, expect, it } from 'vitest';
import { readRepoFile } from '../../fakes/css';
import { SURFACES, openSearchSurface, type SurfaceMessage } from './surfaces';

// A Labs experiment lets Ctrl+N / Ctrl+P move through results on macOS, as in
// Emacs-style text fields. The key mapping is unit-tested beside
// src/shared/search/suggestion-navigation.ts and the Labs switch in
// src/options/features/labs/labs-tab.test.tsx.

const KEY = '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const RESULTS = Array.from({ length: 3 }, (_, index) => ({ type: 'history', title: `Result ${index}`, url: `https://r${index}.test/` }));

describe.each(SURFACES)('%s Ctrl+N / Ctrl+P', (name) => {
  it.each([true, false])('move through results only with the experiment on (%s)', async (enabled) => {
    const surface = await openSearchSurface(name, {
      userAgent: MAC_UA,
      platform: 'MacIntel',
      settings: { [KEY]: enabled },
      respond: (message: SurfaceMessage) => (message.action === 'getSearchSuggestions' ? { suggestions: RESULTS } : undefined)
    });
    await surface.type('result');
    await surface.settle(150);
    expect(surface.selectedIndex()).toBe(0);
    surface.press('n', { code: 'KeyN', ctrlKey: true });
    await surface.settle(40);
    expect(surface.selectedIndex()).toBe(enabled ? 1 : 0);
    expect(surface.input().value).toBe('result');
    if (enabled) {
      surface.press('p', { code: 'KeyP', ctrlKey: true });
      await surface.settle(40);
      expect(surface.selectedIndex()).toBe(0);
    }
    surface.press('ArrowDown');
    await surface.settle(40);
    expect(surface.selectedIndex()).toBe(1);
  });
});

describe('Ctrl+N / Ctrl+P credits and copy', () => {
  it('credits the original contributor and pull request', () => {
    expect(readRepoFile('README.md')).toMatch(/wanghanzhen[\s\S]*?pull\/38/);
  });

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('names and describes the experiment in %s', (locale) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect(messages).toMatchObject({
      settings_macos_ctrl_suggestion_navigation_title: { message: expect.stringMatching(/\S/) },
      settings_macos_ctrl_suggestion_navigation_desc: { message: expect.stringMatching(/\S/) }
    });
  });
});
