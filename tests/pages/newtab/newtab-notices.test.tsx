import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { bootReadyNewtab, settle, waitFor } from './boot';
import { getElement, getElementById, getElements } from '../../fakes/dom';
import enMessages from '../../../_locales/en/messages.json';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import manifest from '../../../manifest.json';
import { DAY_MS, normalizeEngagementState } from '../../../src/shared/engagement-notice';
import { listFeatureHints, normalizeDismissStorage } from '../../../src/shared/ui/feature-hint-catalog';
import type { FeatureHintDismissStorage } from '../../../src/shared/ui/feature-hint-catalog';
import { getFeatureHintDismissKey, getFeatureHintLocalDismissKey } from '../../../src/shared/ui/feature-hint-dismiss';
import { createGraphicsNoticeDefinition } from '../../../src/shared/graphics-acceleration-notice';
import { getUpdateNoticeDisplayCountKey } from '../../../src/platform/update-notice';
import { engagementNoticeState, graphicsProbe, language, updateNoticeEnabled, updateNoticeState } from '../../../src/domain/settings';
import type { GraphicsRendering } from '../../../src/domain/settings/features';

// The notices that share New Tab's one notice per page view: the update
// notice, the graphics acceleration notice and the engagement prompt.

const ROOT_ID = '_x_extension_newtab_root_2024_unique_';
const GRAPHICS_DISMISS_KEY = getFeatureHintLocalDismissKey(createGraphicsNoticeDefinition('newtab'));
const LOCALES: Record<string, unknown> = { en: enMessages, zh_CN: zhCnMessages };
const pendingUpdate = { version: manifest.version, previousVersion: '0.0.1', reason: 'update', updatedAt: 1 };

async function fetchLocales(url: string) {
  const match = /_locales\/([^/]+)\/messages\.json/.exec(url);
  const messages = match ? LOCALES[match[1]] : undefined;
  return { ok: messages !== undefined, json: async () => messages };
}

interface PageOptions {
  language?: string;
  // The probe's answer the worker stored, and its fresh one (the stored by default).
  rendering?: GraphicsRendering;
  fresh?: GraphicsRendering;
  sync?: Record<string, unknown>;
  local?: Record<string, unknown>;
}

// A browser where every feature hint was dismissed and the engagement prompt
// is due, so the notices under test are what is left to show.
function createBrowser(options: PageOptions = {}): BrowserFake {
  const now = Date.now();
  const day = (offset: number) => new Date(now - offset * DAY_MS).toISOString().slice(0, 10);
  const state = normalizeEngagementState(null);
  state.newtab = { activeDays: [day(7), day(5), day(3), day(1)], firstSeenAt: now - 8 * DAY_MS, meaningfulUses: 5, opens: 8 };
  const dismissed: Record<FeatureHintDismissStorage, Record<string, boolean>> = { none: {}, sync: {}, local: {}, session: {} };
  listFeatureHints().forEach((hint) => {
    const area = normalizeDismissStorage(hint.dismissStorage);
    dismissed[area][getFeatureHintDismissKey(hint, area)] = true;
  });
  const rendering = options.rendering || 'hardware';
  const fresh = options.fresh || rendering;
  const browser = createBrowserFake({
    sync: { [language.key]: options.language || 'en', [updateNoticeEnabled.key]: false, ...dismissed.sync, ...options.sync },
    local: {
      [engagementNoticeState.key]: state,
      [graphicsProbe.key]: { rendering, checkedAt: 1 },
      ...dismissed.local,
      ...options.local
    },
    tabs: [{ id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true, pinned: false }],
    respond: (message) => (message.action === 'checkGraphicsRendering' ? { rendering: fresh } : undefined)
  });
  Object.assign(browser.storage.session.values, dismissed.session);
  browser.runtime.getManifest = () => ({ version: manifest.version, manifest_version: 3 });
  return browser;
}

function sentMessages(browser: BrowserFake): Array<Record<string, unknown>> {
  return browser.runtime.sendMessage.mock.calls.map((call) => call[0]).filter(
    (message): message is Record<string, unknown> => typeof message === 'object' && message !== null);
}

function shown(element: Element | null | undefined): boolean {
  return element?.getAttribute('data-visible') === 'true';
}

function updateNotice(): HTMLElement | undefined {
  return getElements(document, '.x-lumno-feature-hint--update-notice')
    .find((hint) => !hint.classList.contains('x-lumno-feature-hint--graphics-notice') && !hint.hasAttribute('data-engagement-surface'));
}

const graphicsNotice = () => document.querySelector('.x-lumno-feature-hint--graphics-notice');
const engagementPrompt = () => document.querySelector('.x-lumno-feature-hint[data-engagement-surface="newtab"]');

async function click(element: Element, init: MouseEventInit = {}): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  });
  await settle();
}

// Past the engagement prompt's delay, so a notice that keeps it away has had
// the chance to.
async function waitPastPromptDelay(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2400));
  });
  await settle();
}

describe('New Tab update notice', () => {
  it('shows below the search layer, counts one showing and opens the release page as the click asks', async () => {
    const browser = createBrowser({ sync: { [updateNoticeEnabled.key]: true, [updateNoticeState.key]: pendingUpdate } });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => shown(updateNotice()), 'the update notice did not appear');
    const notice = getElement(document, '.x-lumno-feature-hint--update-notice:not([data-engagement-surface])');

    const root = getElementById(ROOT_ID);
    expect(root.contains(notice)).toBe(false);
    expect(notice.parentNode).toBe(document.body);
    expect(root.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const countKey = getUpdateNoticeDisplayCountKey(manifest.version);
    await waitFor(() => (browser.storage.sync.values[countKey] ?? browser.storage.local.values[countKey]) !== undefined,
      'the showing was not counted');
    expect(browser.storage.sync.values[countKey] ?? browser.storage.local.values[countKey]).toBe(1);
    expect(getElement(notice, '.x-lumno-feature-hint__badge-icon[data-icon-type="text"]').textContent).toBe('🦋');

    const details = getElements(notice, 'button').find((button) => /changelog/i.test(button.textContent || ''));
    if (!details) {
      throw new Error('Expected the update notice to link to the changelog.');
    }
    await click(details, { metaKey: true });
    expect(sentMessages(browser)).toContainEqual(expect.objectContaining({
      action: 'openReleasePage', reason: 'notice', disposition: 'backgroundTab'
    }));
  });
});

describe('New Tab graphics acceleration notice', () => {
  it('takes the page view from the engagement prompt and opens the browser setting in a new tab', async () => {
    const browser = createBrowser({ rendering: 'software' });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => shown(graphicsNotice()), 'the graphics notice did not appear');
    expect(graphicsNotice()?.textContent).toContain('Graphics acceleration is off');
    await waitPastPromptDelay();
    expect(shown(engagementPrompt())).toBe(false);

    await click(getElement(document, '.x-lumno-feature-hint--graphics-notice .x-lumno-feature-hint__link'));
    expect(sentMessages(browser)).toContainEqual(expect.objectContaining({ action: 'openGraphicsSettings', disposition: 'newTab' }));
    expect(shown(graphicsNotice())).toBe(false);
    expect(browser.storage.local.values[GRAPHICS_DISMISS_KEY]).toBeUndefined();
  });

  it('is remembered on this computer once closed', async () => {
    const browser = createBrowser({ rendering: 'software' });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => shown(graphicsNotice()), 'the graphics notice did not appear');
    await click(getElement(document, '.x-lumno-feature-hint--graphics-notice .x-lumno-feature-hint__close'));
    expect(shown(graphicsNotice())).toBe(false);
    expect(browser.storage.local.values[GRAPHICS_DISMISS_KEY]).toBe(true);
  });

  it('probes again first and shows nothing when the fresh probe finds the GPU', async () => {
    const browser = createBrowser({ rendering: 'software', fresh: 'hardware' });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => sentMessages(browser).some((message) => message.action === 'checkGraphicsRendering'), 'the page did not probe again');
    await settle();
    expect(shown(graphicsNotice())).toBe(false);
  });

  it('costs no probe and leaves the page view to the engagement prompt when the GPU draws', async () => {
    const browser = createBrowser({ rendering: 'hardware' });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => shown(engagementPrompt()), 'the engagement prompt did not appear');
    expect(shown(graphicsNotice())).toBe(false);
    expect(sentMessages(browser).some((message) => message.action === 'checkGraphicsRendering')).toBe(false);
  });

  it('stays closed once closed', async () => {
    const browser = createBrowser({ rendering: 'software', local: { [GRAPHICS_DISMISS_KEY]: true } });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitPastPromptDelay();
    expect(shown(graphicsNotice())).toBe(false);
  });

  it('speaks the page language', async () => {
    const browser = createBrowser({ rendering: 'software', language: 'zh-CN' });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => shown(graphicsNotice()), 'the graphics notice did not appear');
    expect(graphicsNotice()?.textContent).toContain(zhCnMessages.graphics_notice_badge.message);
  });

  it('waits for another page view while an update notice is pending', async () => {
    const browser = createBrowser({
      rendering: 'software',
      sync: { [updateNoticeEnabled.key]: true, [updateNoticeState.key]: pendingUpdate }
    });
    await bootReadyNewtab(browser, { fetch: fetchLocales });
    await waitFor(() => shown(updateNotice()), 'the update notice did not appear');
    await waitPastPromptDelay();
    expect(shown(graphicsNotice())).toBe(false);
  });
});
