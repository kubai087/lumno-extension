import { describe, expect, it, vi } from 'vitest';
import { bootOverlayPage, settle, suggestionOf, waitFor, type OverlayPage } from './boot';

// Commands and keyword shortcuts typed into the overlay.

const DOCUMENT_PIP_KEY = '_x_extension_document_pip_enabled_2026_unique_';
const EDGE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0 Safari/537.36 Edg/149.0';

const offered = (page: OverlayPage, type: string) => page.suggestions().map(suggestionOf).find((item) => item.type === type);

describe('Overlay commands', () => {
  it.each([
    ['Edge', EDGE_USER_AGENT, 'edge://extensions/'],
    ['Chrome', undefined, 'chrome://extensions/']
  ])('points the extensions keyword at %s\'s own page', async (_browser, userAgent, url) => {
    const page = await bootOverlayPage({ userAgent });
    await page.open();
    await page.type('扩展程序');
    await waitFor(() => offered(page, 'browserPage'), 'the extensions keyword offered no browser page');
    expect(offered(page, 'browserPage')?.url).toBe(url);
  });

  it('offers /clip once web clip is turned on in Settings, in an open overlay', async () => {
    vi.stubGlobal('documentPictureInPicture', { requestWindow() {} });
    const page = await bootOverlayPage({ settings: { [DOCUMENT_PIP_KEY]: false } });
    await page.open({ documentPipEnabled: false });
    await page.type('/clip');
    expect(offered(page, 'commandDocumentPip')).toBeUndefined();

    page.changeSetting(DOCUMENT_PIP_KEY, true);
    await page.type('/cli');
    await page.type('/clip');
    await waitFor(() => offered(page, 'commandDocumentPip'), 'turning web clip on did not show the command');
  });

  it('asks the worker for the clip picker and closes so the user can pick', async () => {
    vi.stubGlobal('documentPictureInPicture', { requestWindow() {} });
    const page = await bootOverlayPage({ settings: { [DOCUMENT_PIP_KEY]: true } });
    await page.open({ documentPipEnabled: true });
    await page.type('/clip');
    await waitFor(() => offered(page, 'commandDocumentPip'), 'the clip command did not show');

    const before = page.messages.length;
    page.press('Enter');
    await settle(30);
    expect(page.messages.slice(before).map((message) => message.action)).toContain('openDocumentPipPicker');
    expect(page.host()).toBeNull();
  });

  it('offers no clip command where the browser has no Document Picture-in-Picture', async () => {
    const page = await bootOverlayPage({ settings: { [DOCUMENT_PIP_KEY]: true } });
    await page.open({ documentPipEnabled: true });
    await page.type('/clip');
    expect(offered(page, 'commandDocumentPip')).toBeUndefined();
  });
});
