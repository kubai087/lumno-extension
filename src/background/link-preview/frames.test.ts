import { describe, expect, it, vi } from 'vitest';
import { linkPreviewSessions } from '../../domain/settings/features';
import { createSettingsStore } from '../../platform/settings-store';
import { createLinkPreviewService } from './service';
import type { FrameRedirect } from './types';
import { PREVIEW_FRAME_ID, createPreviewHarness, surfaceResponder } from '../../../tests/fakes/link-preview-service';
import { browserTab } from '../../../tests/fakes/worker';

const tab = (id: number) => browserTab({ id, windowId: 1 });

// A fetch that follows redirects to the address the test gives.
function fetchLandingOn(land: (url: string) => string) {
  return vi.fn<typeof fetch>(async (input) => {
    const response = new Response(null);
    Object.defineProperty(response, 'url', { value: land(String(input)) });
    return response;
  });
}

// What the browser reports when a frame's navigation is redirected.
function frameRedirect(tabId: number, frameId: number, requestId: string, url: string, redirectUrl: string): FrameRedirect {
  return { type: 'sub_frame', tabId, frameId, requestId, url, redirectUrl };
}

describe('the preview frame', () => {
  it('is the one frame below the top that brings its preview’s secret first', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder() });
    await preview.service.open(tab(3), 'https://example.com/a', null);
    const secret = preview.prewarmSecret(3);

    expect(secret).toMatch(/^[0-9a-f]{32}$/);
    expect(preview.sent().find((entry) => entry.message.action === 'lumnoLinkPreviewShow')).toMatchObject({ message: { frameSecret: secret } });
    expect(await preview.service.bindFrame(preview.frameSender(3, 'https://example.com/a', 7), 'guess')).toBe(false);
    expect(await preview.service.bindFrame(preview.frameSender(3, 'https://example.com/a', 0), secret)).toBe(false);
    expect(await preview.bindPreviewFrame(3, 'https://example.com/a')).toBe(true);
    expect(await preview.service.bindFrame(preview.frameSender(3, 'https://example.com/a', 7), secret)).toBe(false);
  });

  it('alone moves the rule to the site the preview went on to', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder() });
    await preview.service.open(tab(3), 'https://example.com/a', null);
    await preview.bindPreviewFrame(3, 'https://example.com/a');

    await preview.service.noteFrameCommitted(preview.frameSender(3, 'https://other.test/x', 7));
    expect(preview.allowedDomains(3)).toEqual(['example.com']);
    await preview.service.noteFrameCommitted(preview.frameSender(3, 'https://other.test/x'));
    expect(preview.allowedDomains(3)).toEqual(['example.com', 'other.test']);
    await preview.service.noteFrameCommitted(preview.frameSender(3, 'https://third.test/y'));
    expect(preview.allowedDomains(3)).toEqual(['example.com', 'third.test']);
  });

  it('tries a refused page once more with the address it went to and where that redirects', async () => {
    const fetchImpl = fetchLandingOn((url) => url.replace('short.test/a', 'final.test/page'));
    const preview = createPreviewHarness({ respond: surfaceResponder(), fetch: fetchImpl });
    await preview.service.open(tab(5), 'https://example.com/a', null);
    const token = String(preview.sent()[0].message.token);
    await preview.bindPreviewFrame(5, 'https://example.com/a');
    await preview.service.noteFrameNavigation(preview.frameSender(5, 'https://example.com/a', 7), 'https://evil.test/');
    await preview.service.noteFrameNavigation(preview.frameSender(5, 'https://example.com/a'), 'https://short.test/a');

    expect(await preview.service.retryRefusedFrame(5, 'stale')).toEqual({ retry: false });
    // Never an address a frame of the page named.
    expect(await preview.service.retryRefusedFrame(5, token)).toEqual({ retry: true, url: 'https://short.test/a' });
    expect(fetchImpl).toHaveBeenCalledWith('https://short.test/a', expect.objectContaining({ redirect: 'follow' }));
    expect(preview.allowedDomains(5)).toEqual(['example.com', 'final.test', 'short.test']);
    expect(await preview.service.retryRefusedFrame(5, token)).toEqual({ retry: false });
    await preview.service.noteFrameCommitted(preview.frameSender(5, 'https://final.test/page'));
    expect(preview.allowedDomains(5)).toEqual(['example.com', 'final.test']);

    const sendResponse = vi.fn();
    preview.service.messageHandlers.linkPreviewFrameRefused({ action: 'linkPreviewFrameRefused', token },
      preview.frameSender(5, 'https://example.com/', 7), sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ retry: false });
  });

  it("follows the preview's first load through its redirects, then only its own frame's", async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder(), fetch: fetchLandingOn(() => 'https://final.test/page') });
    const redirects = preview.fake.chrome.webRequest.onBeforeRedirect;
    await preview.service.open(tab(9), 'https://www.google.com/goto?url=abc#result', null);

    expect(redirects.listeners).toHaveLength(1);
    expect(redirects.addedWith.get(redirects.listeners[0])).toEqual([expect.objectContaining({ types: ['sub_frame'] })]);
    await preview.service.handleFrameRedirect(frameRedirect(9, 11, 'r0', 'https://www.google.com/other', 'https://evil.test/'));
    await preview.service.handleFrameRedirect(frameRedirect(9, 0, 'r9', 'https://www.google.com/goto?url=abc', 'https://evil.test/'));
    await preview.service.handleFrameRedirect(frameRedirect(10, 12, 'r1', 'https://www.google.com/goto?url=abc', 'https://evil.test/'));
    expect(preview.allowedDomains(9)).toEqual(['google.com']);

    await preview.service.handleFrameRedirect(frameRedirect(9, 12, 'r1', 'https://www.google.com/goto?url=abc', 'https://hop.test/x'));
    await preview.service.handleFrameRedirect(frameRedirect(9, 12, 'r1', 'https://hop.test/x', 'https://developer.mozilla.org/en'));
    expect(preview.allowedDomains(9)).toEqual(['developer.mozilla.org', 'google.com', 'hop.test']);
    await preview.bindPreviewFrame(9, 'https://developer.mozilla.org/en');
    expect(preview.allowedDomains(9)).toEqual(['developer.mozilla.org', 'google.com']);

    await preview.service.handleFrameRedirect(frameRedirect(9, 12, 'r2', 'https://developer.mozilla.org/a', 'https://evil.test/'));
    expect(preview.allowedDomains(9)).toEqual(['developer.mozilla.org', 'google.com']);
    await preview.service.handleFrameRedirect(frameRedirect(9, PREVIEW_FRAME_ID, 'r3', 'https://developer.mozilla.org/a', 'https://final.test/page'));
    expect(preview.allowedDomains(9)).toEqual(['developer.mozilla.org', 'final.test', 'google.com']);
    const token = String(preview.sent()[0].message.token);
    // A domain allowed on a redirect that came too late for its load is tried once more.
    expect((await preview.service.retryRefusedFrame(9, token)).retry).toBe(true);

    await preview.service.discard(9, token);
    expect(redirects.listeners).toHaveLength(0);
  });

  it('is still known to a worker woken while its preview is on screen', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder({ lumnoLinkPreviewPing: null }) });
    // Each worker reads the saved sessions afresh.
    const workerSettings = () => createSettingsStore({ chromeApi: chrome, settings: [linkPreviewSessions] });
    const first = createLinkPreviewService({ chromeApi: chrome, settingsStore: workerSettings() });
    await first.open(tab(8), 'https://example.com/a', null);
    const token = String(preview.sent()[0].message.token);
    await first.bindFrame(preview.frameSender(8, 'https://example.com/a'), preview.prewarmSecret(8));
    await vi.waitFor(() => expect(Object.keys(preview.fake.storage.session.values).length + Object.keys(preview.fake.storage.local.values).length)
      .toBeGreaterThan(0));

    preview.setRespond((message) => (message.action === 'lumnoLinkPreviewPing' ? { token } : true));
    const woken = createLinkPreviewService({ chromeApi: chrome, settingsStore: workerSettings() });
    woken.attach();
    await woken.noteFrameCommitted(preview.frameSender(8, 'https://other.test/x'));
    expect(preview.allowedDomains(8)).toEqual(['example.com', 'other.test']);

    await woken.discard(8, token);
    expect(preview.hasTabRules(8)).toBe(false);
    await vi.waitFor(() => expect(Object.values({ ...preview.fake.storage.session.values, ...preview.fake.storage.local.values })
      .find((value) => typeof value === 'object')).toEqual({}));
  });
});
