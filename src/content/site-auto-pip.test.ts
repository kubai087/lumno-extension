import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openAutoPipPage } from '../../tests/fakes/auto-pip-page';
import type { AutoPipPage } from '../../tests/fakes/auto-pip-page';
import type { ContentChromeOptions } from '../../tests/fakes/content-chrome';

let current: AutoPipPage | null = null;

async function loadSiteAutoPip(url: string, options: ContentChromeOptions = {}): Promise<AutoPipPage> {
  const page = openAutoPipPage({ url, ...options });
  current = page;
  vi.resetModules();
  await import('./site-auto-pip');
  await vi.advanceTimersByTimeAsync(10);
  return page;
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

describe('site auto PiP', () => {
  it('sets up and enters PiP from the main world on iQIYI', async () => {
    const page = await loadSiteAutoPip('https://www.iqiyi.com/v_123.html', {
      replies: {
        iqiyiTryEnterPiPInMainWorld: () => { page.page.pipElement = page.video; return { ok: true }; },
        forceExitPiPInMainWorld: () => { page.page.pipElement = null; return { ok: true }; }
      }
    });
    expect(page.takeActions()).toEqual(['iqiyiSetupAutoPiPInMainWorld']);
    expect(page.storageWrites).toEqual([]);
    // The page bridge is registered by the worker, not injected here.
    expect(document.querySelector('script')).toBeNull();

    page.setVisibility('hidden');
    await page.waitFor(() => page.page.pipElement === page.video, 'iQIYI to enter PiP');
    expect(page.takeActions()).toEqual([
      'iqiyiSetupAutoPiPInMainWorld',
      'pipRequestOwnership',
      'iqiyiSetupAutoPiPInMainWorld',
      'iqiyiTryEnterPiPInMainWorld'
    ]);

    page.setPaused(true);
    page.setVisibility('visible');
    await page.waitFor(() => page.messages.some((message) => message.action === 'pipReleaseOwnership'), 'ownership release');
    await vi.advanceTimersByTimeAsync(20);
    expect(page.page.pipElement).toBeNull();
    expect(page.takeActions()).toEqual(['forceExitPiPInMainWorld', 'pipReleaseOwnership']);
    expect(page.page.playCalls).toBe(1);
  });

  it('falls back to the video request on Douyin, lifting disablePictureInPicture for it', async () => {
    const page = await loadSiteAutoPip('https://www.douyin.com/video/1');
    expect(page.takeActions()).toEqual([]);
    page.video.disablePictureInPicture = true;
    page.setVisibility('hidden');
    await page.waitFor(() => page.page.pipElement === page.video, 'Douyin to enter PiP');
    expect(page.takeActions()).toEqual(['pipRequestOwnership', 'siteTryEnterPiPInMainWorld']);
    expect(page.page.requestedDisablePiP).toBe(false);
    expect(page.video.disablePictureInPicture).toBe(true);
  });

  it('needs a user gesture on other sites and leaves PiP itself when turned off', async () => {
    const page = await loadSiteAutoPip('https://www.bilibili.com/video/BV1');
    page.setPaused(true);
    page.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(300);
    expect(page.page.pipElement).toBeNull();
    page.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(20);
    page.takeActions();

    page.setPaused(false);
    document.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(1400);
    page.setVisibility('hidden');
    await page.waitFor(() => page.page.pipElement === page.video, 'Bilibili to enter PiP');
    expect(page.takeActions()).toEqual(['pipRequestOwnership']);

    page.setAutoPipEnabled(false);
    await page.waitFor(() => page.messages.some((message) => message.action === 'pipReleaseOwnership'), 'release after turning off');
    expect(page.page.pipElement).toBeNull();
    // Neither the main world nor the page bridge left PiP, so the script did.
    expect(page.page.exitCalls).toBe(1);
    expect(page.takeActions()).toEqual(['forceExitPiPInMainWorld', 'pipReleaseOwnership']);
  });

  it('does nothing on a blacklisted host', async () => {
    const page = await loadSiteAutoPip('https://www.taobao.com/item');
    page.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(50);
    expect(page.takeActions()).toEqual([]);
    expect(page.messageListeners).toHaveLength(0);
  });
});
