import { describe, expect, it, vi } from 'vitest';
import { WORKER_RULE_ID } from './constants';
import { buildFrameHeaderRules, buildWorkerHeaderRule } from './frame-rules';
import type { TimerHandle } from './types';
import { SCREENSHOT, createPreviewHarness, surfaceResponder } from '../../../tests/fakes/link-preview-service';
import { browserTab } from '../../../tests/fakes/worker';

const tab = (id: number, windowId = 1, index = 0) => browserTab({ id, windowId, index });

describe('the link preview service', () => {
  it('shares one screenshot between the press and the click and lets the tab frame the page while it is open', async () => {
    const preview = createPreviewHarness();
    preview.service.prepare(tab(3, 1, 2), 'https://example.com/a');

    expect(await preview.service.open(tab(3, 1, 2), 'https://example.com/a', { x: 10, y: 20 })).toEqual({ ok: true });
    expect(preview.captures()).toBe(1);
    expect(preview.injections().map((injection) => injection.target)).toEqual([{ tabId: 3, frameIds: [0] }]);
    expect(preview.hasTabRules(3)).toBe(true);
    expect(preview.rules.has(WORKER_RULE_ID)).toBe(true);
    const sent = preview.sent().map((entry) => entry.message);
    expect(sent.map((message) => message.action)).toEqual(['lumnoLinkPreviewPrewarm', 'lumnoLinkPreviewScreenshot', 'lumnoLinkPreviewShow']);
    // The screenshot reaches the surface before the click, to be decoded while the button is down.
    expect(sent[1].screenshot).toBe(SCREENSHOT);
    expect(sent[2]).toMatchObject({ screenshot: '', origin: { x: 10, y: 20 }, token: sent[0].token });
  });

  it('drops the rules when the preview closes, not on a close from a replaced one', async () => {
    const preview = createPreviewHarness();
    await preview.service.open(tab(3), 'https://example.com/a', null);
    const token = String(preview.sent()[0].message.token);

    await preview.service.discard(3, 'stale-token');
    expect(preview.hasTabRules(3)).toBe(true);
    await preview.service.discard(3, token);
    expect(preview.hasTabRules(3)).toBe(false);
    expect(preview.rules.has(WORKER_RULE_ID)).toBe(false);
  });

  it('loads the page for Shift over a link and leaves the screenshot to the press', async () => {
    const preview = createPreviewHarness();
    const hovered = preview.service.prepare(tab(3), 'https://example.com/a', { capture: false });
    await (hovered && hovered.ready);
    await preview.flush();

    expect(preview.captures()).toBe(0);
    expect(preview.sent().map((entry) => entry.message.action)).toEqual(['lumnoLinkPreviewPrewarm']);
    expect(preview.service.prepare(tab(3), 'https://example.com/a')).toBe(hovered);
    expect(await preview.service.open(tab(3), 'https://example.com/a', { x: 1, y: 2 })).toEqual({ ok: true });
    expect(preview.captures()).toBe(1);
    expect(preview.sent().map((entry) => entry.message.action))
      .toEqual(['lumnoLinkPreviewPrewarm', 'lumnoLinkPreviewScreenshot', 'lumnoLinkPreviewShow']);
  });

  it('lets an unclaimed press expire with its rules', async () => {
    const timers: { run: () => void }[] = [];
    const preview = createPreviewHarness({
      setTimeout: (run) => {
        const timer = { run };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer: TimerHandle) => {
        const index = timers.findIndex((each) => each === timer);
        if (index >= 0) timers.splice(index, 1);
      }
    });
    preview.service.prepare(tab(4), 'https://example.com/b');
    await preview.flush();

    expect(preview.hasTabRules(4)).toBe(true);
    timers.slice().forEach((timer) => timer.run());
    await preview.flush();
    expect(preview.hasTabRules(4)).toBe(false);
  });

  it('cancels a press released away from the link at once, but not an open preview', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder() });
    preview.service.prepare(tab(6), 'https://example.com/a');
    await preview.flush();

    expect(preview.hasTabRules(6)).toBe(true);
    await preview.service.cancel(6);
    expect(preview.hasTabRules(6)).toBe(false);
    expect(preview.rules.has(WORKER_RULE_ID)).toBe(false);
    expect(preview.sent().some((entry) => entry.message.action === 'lumnoLinkPreviewDiscard')).toBe(true);
    await preview.service.open(tab(6), 'https://example.com/a', null);
    await preview.service.cancel(6);
    expect(preview.hasTabRules(6)).toBe(true);
  });

  it('opens the link in a tab when the page has no surface', async () => {
    const preview = createPreviewHarness({ respond: () => undefined });
    const sendResponse = vi.fn();
    preview.service.messageHandlers.linkPreviewOpen(
      { action: 'linkPreviewOpen', url: 'https://example.com/c', origin: { x: 1, y: 1 } }, { tab: tab(5), frameId: 0 }, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, reason: 'surface-unavailable' }));
    expect(preview.created()).toEqual([{ url: 'https://example.com/c', active: true, index: 1, openerTabId: 5, windowId: 1 }]);
    expect(preview.hasTabRules(5)).toBe(false);
  });

  // The preview's frame loading can report the tab as loading before the
  // click reaches the surface.
  it('keeps an opening preview when its frame loads, and opens no tab beside it', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder({ lumnoLinkPreviewPing: { token: '' } }) });
    preview.service.prepare(tab(6), 'https://example.com/d');
    const sendResponse = vi.fn();
    preview.service.messageHandlers.linkPreviewOpen({ action: 'linkPreviewOpen', url: 'https://example.com/d' }, { tab: tab(6), frameId: 0 }, sendResponse);
    await preview.service.handleTabUpdated(6, { status: 'loading' });

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
    expect(preview.hasTabRules(6)).toBe(true);
    expect(preview.created()).toEqual([]);
  });

  it('sends a screenshot the surface refused along with the show', async () => {
    const preview = createPreviewHarness({ respond: (message) => message.action !== 'lumnoLinkPreviewScreenshot' });

    expect(await preview.service.open(tab(10), 'https://example.com/g', null)).toEqual({ ok: true });
    expect(preview.sent().find((entry) => entry.message.action === 'lumnoLinkPreviewShow')).toMatchObject({ message: { screenshot: SCREENSHOT } });
  });

  it('leaves a failed show to the surface, which may be on screen, without opening a tab', async () => {
    const preview = createPreviewHarness({ respond: (message) => message.action !== 'lumnoLinkPreviewShow' });
    const sendResponse = vi.fn();
    preview.service.messageHandlers.linkPreviewOpen({ action: 'linkPreviewOpen', url: 'https://example.com/e' }, { tab: tab(7), frameId: 0 }, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, reason: 'show-failed' }));
    expect(preview.created()).toEqual([]);
  });

  it('drops the rules when a navigation took the surface away', async () => {
    let surfaceToken: unknown = null;
    const preview = createPreviewHarness({
      respond: (message) => {
        if (message.action === 'lumnoLinkPreviewPing') return surfaceToken === null ? undefined : { token: surfaceToken };
        if (message.action === 'lumnoLinkPreviewShow') surfaceToken = message.token;
        return true;
      }
    });

    expect(await preview.service.open(tab(9), 'https://example.com/f', null)).toEqual({ ok: true });
    await preview.service.handleTabUpdated(9, { status: 'complete' });
    expect(preview.hasTabRules(9)).toBe(true);
    surfaceToken = null;
    await preview.service.handleTabUpdated(9, { status: 'complete' });
    expect(preview.hasTabRules(9)).toBe(false);
  });

  it('removes the rules of previews that are gone when the worker wakes', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder({ lumnoLinkPreviewPing: { token: '' } }) });
    buildFrameHeaderRules(8, [2, 3], ['example.com']).forEach((rule) => preview.rules.set(rule.id, rule));
    preview.rules.set(WORKER_RULE_ID, buildWorkerHeaderRule(['example.com']));
    await preview.service.reconcileRules();

    expect(preview.hasTabRules(8)).toBe(false);
    expect(preview.rules.has(WORKER_RULE_ID)).toBe(false);
  });

  it("keeps the workers' rule while another tab's preview needs it", async () => {
    const preview = createPreviewHarness();
    await preview.service.open(tab(5, 1), 'https://example.com/a', null);
    await preview.service.open(tab(6, 2), 'https://example.com/b', null);
    await preview.service.handleTabRemoved(5);

    expect(preview.rules.has(WORKER_RULE_ID)).toBe(true);
    await preview.service.handleTabRemoved(6);
    expect(preview.rules.has(WORKER_RULE_ID)).toBe(false);
  });

  it('still previews in a browser that cannot match on headers, dropping the whole CSP', async () => {
    const preview = createPreviewHarness();
    const update = preview.fake.chrome.declarativeNetRequest.updateSessionRules.getMockImplementation();
    preview.fake.chrome.declarativeNetRequest.updateSessionRules.mockImplementation((changes, callback) => {
      if ((changes.addRules || []).some((rule) => rule.condition.responseHeaders) && callback) {
        preview.fake.chrome.runtime.lastError = { message: 'Unknown key responseHeaders' };
        callback();
        preview.fake.chrome.runtime.lastError = null;
        return undefined;
      }
      return update ? update(changes, callback) : undefined;
    });

    expect(await preview.service.open(tab(9), 'https://example.com/a', null)).toEqual({ ok: true });
    expect((preview.tabRules(9)[0].action.responseHeaders || []).map((entry) => entry.header))
      .toEqual(['x-frame-options', 'content-security-policy']);
  });

  it("keeps rule ids within what Chrome accepts for tab ids past a billion, and drops a closed tab's", async () => {
    const preview = createPreviewHarness();
    await preview.service.open(tab(2000000000), 'https://example.com/a', null);
    await preview.service.open(tab(2000000001), 'https://example.com/b', null);
    const ids = Array.from(preview.rules.keys());

    expect(preview.tabRules(2000000000)).toHaveLength(2);
    expect(ids.every((id) => Number.isInteger(id) && id >= 1 && id < 2 ** 31)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    await preview.service.handleTabRemoved(2000000000);
    expect(preview.hasTabRules(2000000000)).toBe(false);
    expect(preview.tabRules(2000000001)).toHaveLength(2);
  });

  it('names only the previewed site in its rules, and both addresses of an X post', async () => {
    const preview = createPreviewHarness({ respond: surfaceResponder() });
    await preview.service.open(tab(3), 'https://www.example.com/a', null);

    expect(preview.allowedDomains(3)).toEqual(['example.com']);
    expect(preview.tabRules(3).every((rule) => (rule.condition.requestDomains || []).length === 1)).toBe(true);
    await preview.service.open(tab(4), 'https://twitter.com/a_b/status/42', null);
    expect(preview.allowedDomains(4)).toEqual(['twitter.com', 'x.com']);
    expect(preview.rules.get(WORKER_RULE_ID)).toMatchObject({ condition: { requestDomains: ['example.com', 'twitter.com', 'x.com'] } });
    await preview.service.handleTabRemoved(4);
    expect(preview.rules.get(WORKER_RULE_ID)).toMatchObject({ condition: { requestDomains: ['example.com'] } });
  });
});
