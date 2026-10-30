import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_PIP_KEY, openAutoPipPage } from '../../tests/fakes/auto-pip-page';
import type { AutoPipPage } from '../../tests/fakes/auto-pip-page';
import type { ContentChromeOptions } from '../../tests/fakes/content-chrome';

let current: AutoPipPage | null = null;

async function loadYoutubeAutoPip(url: string, options: ContentChromeOptions = {}): Promise<AutoPipPage> {
  const page = openAutoPipPage({ url, ...options });
  current = page;
  vi.resetModules();
  await import('./youtube-auto-pip');
  await vi.advanceTimersByTimeAsync(10);
  return page;
}

function released(page: AutoPipPage): boolean {
  return page.messages.some((message) => message.action === 'pipReleaseOwnership');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  if (current) current.close();
  current = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('YouTube auto PiP', () => {
  it('enters when hidden, leaves when shown, and surrenders to another tab', async () => {
    const page = await loadYoutubeAutoPip('https://www.youtube.com/watch?v=abc&lumno_pip_recover=1', {
      replies: { ytForceExitPiPInMainWorld: () => { page.page.pipElement = null; return { ok: true }; } }
    });
    // The recovery marker is removed from the address on load.
    expect(window.location.search).toBe('?v=abc');
    expect(document.querySelector('script')).toBeNull();
    expect(page.takeActions()).toEqual([]);

    page.setVisibility('hidden');
    await page.waitFor(() => page.page.pipElement === page.video, 'YouTube to enter PiP');
    expect(page.takeActions()).toEqual(['pipRequestOwnership']);

    page.setVisibility('visible');
    await page.waitFor(() => released(page), 'YouTube to release ownership');
    await vi.advanceTimersByTimeAsync(20);
    expect(page.page.pipElement).toBeNull();
    expect(page.takeActions()).toEqual(['ytForceExitPiPInMainWorld', 'pipReleaseOwnership']);

    await vi.advanceTimersByTimeAsync(1500);
    page.setVisibility('hidden');
    await page.waitFor(() => page.page.pipElement === page.video, 'YouTube to enter PiP again');
    page.takeActions();
    const surrendered = page.surrender();
    await page.waitFor(() => released(page), 'the surrender to finish');
    await expect(surrendered).resolves.toEqual({ ok: true, reason: 'other-tab' });
    expect(page.page.pipElement).toBeNull();
    // Surrendering while hidden pauses the media.
    expect(page.video.paused).toBe(true);
    expect(page.takeActions()).toEqual(['ytForceExitPiPInMainWorld', 'pipReleaseOwnership']);
  });

  it('stays off when the stored setting is false and writes nothing', async () => {
    const page = await loadYoutubeAutoPip('https://www.youtube.com/watch?v=abc', { sync: { [AUTO_PIP_KEY]: false } });
    expect(page.storageWrites).toEqual([]);
    page.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(100);
    expect(page.page.pipElement).toBeNull();
    expect(page.takeActions()).toEqual([]);
  });
});
