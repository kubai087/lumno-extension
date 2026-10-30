import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getElement, getTags } from '../../fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../fakes/options-page';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { COMMUNITY_LINKS_URL, FALLBACK_LINKS } from '../../../src/platform/community-links';
import { GeneralGlobalSection } from '../../../src/options/features/general/global-section';

// Settings takes the WeChat group's QR code from the website's community
// links as the page loads them, so a new code reaches it without a release.

afterEach(cleanUpOptionsViews);

describe('Options community links', () => {
  it('shows the WeChat QR code from the remote community links instead of the bundled one', async () => {
    const remoteQr = 'https://lumno.kubai.design/qr-remote.webp';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url) === COMMUNITY_LINKS_URL
      ? { ok: true, json: async () => ({ links: { wechatQr: remoteQr } }) }
      : fetchPackaged(url))));
    const { host, page } = renderOptionsView(<GeneralGlobalSection />);
    act(() => page.locale.store.setState({ mode: 'zh-CN', locale: 'zh_CN' }));

    await act(async () => {
      getElement(host, '#_x_extension_feedback_support_2026_unique_ [data-feedback-support="community"]').click();
    });
    await vi.waitFor(() => {
      const sources = getTags(host, 'img', 'img').map((image) => image.getAttribute('src'));
      expect(sources).toContain(remoteQr);
      expect(sources).not.toContain(FALLBACK_LINKS.wechatQr);
    });
  });
});
