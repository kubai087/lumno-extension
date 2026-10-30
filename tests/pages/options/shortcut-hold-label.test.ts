import { describe, expect, it } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';
import { bootOptionsPage } from './boot';

describe('Settings shortcut reference', () => {
  it.each([['MacIntel', '⌘'], ['Win32', 'Ctrl']])('shows the long-hold instruction with the %s modifier', async (platform, modifier) => {
    await bootOptionsPage(createBrowserFake({ sync: { _x_extension_language_2024_unique_: 'en' } }), { platform });

    expect(document.body.textContent).toContain(`Hold ${modifier} for 0.4s, release, then press 0–9`);
  });
});
