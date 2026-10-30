import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMMUNITY_LINKS_URL,
  EDGE_ADDONS_EXTENSION_ID,
  FALLBACK_LINKS,
  createLoader,
  getReviewUrl,
  getStoreListing,
  normalizeLinksPayload
} from './community-links';
import type { FetchLike } from './community-links';

const remoteReviews = normalizeLinksPayload({
  links: { chrome_review: 'https://example.com/chrome-review', edge_review: 'https://example.com/edge-review' }
});

const quietTimers = { setTimeout: () => 1, clearTimeout() {} };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('community links of this install', () => {
  it('review and list on Edge Add-ons when running under its id', () => {
    vi.stubGlobal('chrome', { runtime: { id: EDGE_ADDONS_EXTENSION_ID } });
    expect(getReviewUrl(remoteReviews)).toBe('https://example.com/edge-review');
    expect(getStoreListing().id).toBe('edge');
  });

  it('review and list on Firefox Add-ons when running under a Gecko id', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'lumno@kubai087' } });
    expect(getReviewUrl(FALLBACK_LINKS)).toBe(FALLBACK_LINKS.firefoxReview);
    expect(getStoreListing().id).toBe('firefox');
  });
});

describe('community links loader', () => {
  it('fetches the remote list once per page, uncached, and again when forced', async () => {
    let revision = 1;
    const fetchImpl = vi.fn<FetchLike>(async () => ({
      ok: true,
      json: async () => ({ links: { wechatQr: `https://cdn.example.com/qr-v${revision}.webp` } })
    }));
    const loader = createLoader({ fetchImpl, windowObj: quietTimers });

    expect((await loader.load()).wechatQr).toBe('https://cdn.example.com/qr-v1.webp');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(COMMUNITY_LINKS_URL);
    expect(fetchImpl.mock.calls[0][1].cache).toBe('no-store');

    revision = 2;
    expect((await loader.load()).wechatQr).toBe('https://cdn.example.com/qr-v1.webp');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    expect((await loader.load({ force: true })).wechatQr).toBe('https://cdn.example.com/qr-v2.webp');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps the fallbacks after a failed load and retries only when forced', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error('offline');
    });
    const loader = createLoader({ fetchImpl });

    expect(await loader.load()).toEqual(FALLBACK_LINKS);
    await loader.load();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loader.load({ force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
