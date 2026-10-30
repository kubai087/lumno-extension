import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import onboardingHtml from '../../../src/onboarding/onboarding.html?raw';
import { runPageBundle } from '../page-bundles';
import { createBrowserFake } from '../../fakes/browser';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { required } from '../../fakes/dom';
import { EDGE_ADDONS_EXTENSION_ID, getStoreListing } from '../../../src/platform/community-links';

// Onboarding's last slide asks for a rating on the store the extension was
// installed from.

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Onboarding rating', () => {
  it('opens the Edge Add-ons listing for an Edge Add-ons install', async () => {
    const parsed = new DOMParser().parseFromString(onboardingHtml, 'text/html');
    document.body.appendChild(document.importNode(required(parsed.getElementById('onboarding-root'), 'shell'), true));
    const browser = createBrowserFake();
    browser.runtime.id = EDGE_ADDONS_EXTENSION_ID;
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
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    const rate = await vi.waitFor(() => required(document.querySelector('[data-action="openChromeWebStore"]'), 'the rating button'));
    await act(async () => {
      rate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    await vi.waitFor(() => {
      expect(browser.runtime.sendMessage.mock.calls.map((call) => call[0])).toContainEqual(expect.objectContaining({
        action: 'createTab', url: getStoreListing(EDGE_ADDONS_EXTENSION_ID).url
      }));
    });
  });
});
