import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import onboardingHtml from '../../../src/onboarding/onboarding.html?raw';
import * as onboardingContent from '../../../src/onboarding/onboarding-content';
import { runPageBundle } from '../page-bundles';
import { expectElement, getElements, required } from '../../fakes/dom';
import { queryHtmlTag } from '../../../src/shared/dom-lookup';

const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
const VISUAL_SURFACE_BY_KIND: Record<string, string> = {
  'lumno-web-wordmark-surface': 'onboarding-lumno-wordmark-surface',
  'bookmark-focus-surface': 'onboarding-bookmark-focus-surface',
  'newtab-preview-surface': 'onboarding-newtab-preview-surface',
  'site-search-demo-surface': 'onboarding-site-search-demo-surface',
  'feature-cards-surface': 'onboarding-feature-cards-surface'
};
const addedListeners: Array<[
  EventTarget,
  string,
  EventListenerOrEventListenerObject,
  boolean | AddEventListenerOptions | undefined
]> = [];

function trackListeners(target: EventTarget): void {
  const addEventListener = target.addEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      if (listener) {
        addedListeners.push([target, type, listener, options]);
        addEventListener(type, listener, options);
      }
    }
  );
}

function createChromeStub(stored: Record<string, unknown>) {
  const read = (keys: string[], callback?: (result: object) => void) => {
    const result = Object.fromEntries(
      keys.filter((key) => key in stored).map((key) => [key, stored[key]])
    );
    if (callback) {
      callback(result);
      return undefined;
    }
    return Promise.resolve(result);
  };
  return {
    commands: {
      getAll: (callback: (commands: object[]) => void) => callback([
        { name: 'show-search', shortcut: 'Ctrl+Shift+K' }
      ])
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      getURL: (path: string) => `chrome-extension://lumno/${path}`,
      id: 'nggfkkbmogmadfoikakkfegkoilfcfao',
      lastError: null,
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn()
    },
    storage: {
      local: { get: vi.fn((keys: string[], callback?: (result: object) => void) => read(keys, callback)) },
      sync: { get: vi.fn((keys: string[], callback?: (result: object) => void) => read(keys, callback)) }
    }
  };
}

async function bootOnboardingPage(stored: Record<string, unknown> = {}) {
  const parsed = new DOMParser().parseFromString(onboardingHtml, 'text/html');
  const shell = parsed.getElementById('onboarding-root');
  document.body.appendChild(document.importNode(required(shell, 'shell'), true));

  const chrome = createChromeStub(stored);
  vi.stubGlobal('chrome', chrome);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener() {},
    removeEventListener() {}
  }));
  vi.resetModules();
  await runPageBundle('onboarding-preload');
  trackListeners(document);
  trackListeners(window);
  await act(async () => {
    await runPageBundle('onboarding');
  });
  return {
    chrome,
    root: expectElement(document.getElementById('onboarding-root')),
    stage: () => expectElement(document.getElementById('onboarding-visual-stage'))
  };
}

async function waitForFirstRender(root: HTMLElement): Promise<void> {
  await act(async () => {
    await vi.waitFor(() => {
      expect(root.dataset.direction).toBeDefined();
    });
  });
}

afterEach(() => {
  addedListeners.splice(0).forEach(([target, type, listener, options]) => {
    target.removeEventListener(type, listener, options);
  });
  vi.unstubAllGlobals();
  // The page mirrors the active slide into ?slide=.
  window.history.replaceState(null, '', '/');
});

describe('Onboarding page runtime', () => {
  it('draws the page through its React view', async () => {
    const { root } = await bootOnboardingPage();
    await waitForFirstRender(root);

    expect(root.getAttribute('data-react-island')).toBe('onboarding-page');
    expect(document.getElementById('onboarding-page-strip')).not.toBeNull();
  });

  it('reads the stored language and renders every slide visual through the React surface', async () => {
    const { chrome, root, stage } = await bootOnboardingPage({
      [LANGUAGE_STORAGE_KEY]: 'ja'
    });
    await waitForFirstRender(root);

    const blueprint = onboardingContent.getOnboardingBlueprint('ja');
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(
      [LANGUAGE_STORAGE_KEY],
      expect.any(Function)
    );
    expect(document.documentElement.lang).toBe(blueprint.htmlLang);

    for (let index = 0; index < blueprint.slides.length; index += 1) {
      const slide = blueprint.slides[index];
      expect(root.dataset.activeIndex).toBe(String(index));
      expect(root.dataset.activeSlide).toBe(slide.id);
      expect(document.getElementById('onboarding-copy-panel')?.dataset.slideId).toBe(slide.id);
      expect(stage().dataset.visualKind).toBe(slide.visual.kind);
      const surfaces = Array.from(
        getElements(stage(), ':scope > [data-visual-surface]'),
        (node) => node.dataset.visualSurface
      );
      expect(surfaces).toEqual(
        slide.visual.visible ? [VISUAL_SURFACE_BY_KIND[slide.visual.kind]] : []
      );
      expect(stage().firstElementChild?.childElementCount).toBeGreaterThan(0);

      if (index === 0) {
        // The React action button advances exactly one slide.
        act(() => {
          queryHtmlTag(document, '.onboarding-action-button--primary', 'button')
            ?.click();
        });
      } else {
        act(() => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
          );
        });
      }
    }
    expect(root.dataset.activeIndex).toBe(String(blueprint.slides.length - 1));
  });

  it('opens accordion link actions on click and in the background on middle-click', async () => {
    const { chrome, root } = await bootOnboardingPage();
    await waitForFirstRender(root);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(root.dataset.activeSlide).toBe('setup');

    const link = queryHtmlTag(document, '.interaction-accordion-link[data-action="openShortcuts"]', 'a');
    expect(link).toBeTruthy();
    act(() => {
      required(link, 'link').click();
    });
    act(() => {
      required(link, 'link').dispatchEvent(
        new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })
      );
    });

    expect(chrome.runtime.sendMessage.mock.calls.map(([message]) => message))
      .toEqual([
        { action: 'openExtensionShortcutsPage', disposition: 'newTab' },
        { action: 'openExtensionShortcutsPage', disposition: 'backgroundTab' }
      ]);
  });
});
