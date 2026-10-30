import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { language, motionEffectsEnabled } from '../../../src/domain/settings';
import { createBrowserFake } from '../../fakes/browser';
import { getElementById } from '../../fakes/dom';
import { bootReadyNewtab, settle, waitFor } from './boot';

// The motion effects setting turns off the New Tab entrance. New Tab's
// preload marks the saved preference before the page shows and follows
// synchronized changes.
describe('New Tab motion effects', () => {
  it('installs every final entry state before revealing a motion-free page, and follows the synced setting', async () => {
    const order: string[] = [];
    const observer = new MutationObserver((records) => records.forEach((record) => {
      const name = record.attributeName || '';
      order.push(`${name}=${document.body.getAttribute(name)}`);
    }));
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-nt-enter', 'data-nt-ready'] });
    const browser = createBrowserFake({ sync: { [language.key]: 'en', [motionEffectsEnabled.key]: false } });

    await bootReadyNewtab(browser);
    await settle();
    observer.disconnect();

    const root = document.documentElement;
    expect(root.getAttribute('data-lumno-motion-effects')).toBe('off');
    expect(order).toContain('data-nt-enter=done');
    expect(order.indexOf('data-nt-enter=done')).toBeLessThan(order.indexOf('data-nt-ready=1'));
    expect(order).not.toContain('data-nt-enter=run');
    expect(getElementById('_x_extension_newtab_root_2024_unique_').getAttribute('data-lumno-search-entry')).toBe('done');

    await act(async () => browser.storage.sync.externalSet({ [motionEffectsEnabled.key]: true }));
    await waitFor(() => root.getAttribute('data-lumno-motion-effects') === 'on', 'the preference did not follow sync');
  });
});
