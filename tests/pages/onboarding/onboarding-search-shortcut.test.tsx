import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import onboardingHtml from '../../../src/onboarding/onboarding.html?raw';
import { runPageBundle } from '../page-bundles';
import { createBrowserFake } from '../../fakes/browser';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { required } from '../../fakes/dom';

// Onboarding answers the browser's search shortcut with the overlay it
// demonstrates; opening it imports the overlay the worker injects into web
// pages, so the requests for that URL count the opens.
const OVERLAY_SCRIPT = 'build/injected/overlay.js';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

async function press(init: KeyboardEventInit): Promise<void> {
  await act(async () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('Onboarding search shortcut', () => {
  it('opens the demo overlay on the bound shortcut and ignores other combinations', async () => {
    const parsed = new DOMParser().parseFromString(onboardingHtml, 'text/html');
    document.body.appendChild(document.importNode(required(parsed.getElementById('onboarding-root'), 'shell'), true));
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const browser = createBrowserFake();
    browser.commands.getAll = (callback?: (commands: object[]) => void) => {
      queueMicrotask(() => callback?.([{ name: 'show-search', shortcut: '⌘K' }]));
      return undefined;
    };
    const getURL = vi.spyOn(browser.runtime, 'getURL');
    vi.stubGlobal('chrome', browser);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener() {},
      removeEventListener() {}
    }));
    vi.stubGlobal('fetch', vi.fn(fetchPackaged));
    vi.resetModules();
    await runPageBundle('onboarding-preload');
    await act(async () => {
      await runPageBundle('onboarding');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const opens = () => getURL.mock.calls.filter(([resource]) => resource === OVERLAY_SCRIPT).length;

    await press({ key: 'J', code: 'KeyJ', metaKey: true, shiftKey: true });
    expect(opens()).toBe(0);

    await press({ key: 'k', code: 'KeyK', metaKey: true });
    await vi.waitFor(() => {
      expect(opens()).toBe(1);
    });
  });
});
