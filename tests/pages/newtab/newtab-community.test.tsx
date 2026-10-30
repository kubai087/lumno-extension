import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { bootReadyNewtab, settle, waitFor } from './boot';
import { getElements, getTag } from '../../fakes/dom';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import { DAY_MS, normalizeEngagementState } from '../../../src/shared/engagement-notice';
import { listFeatureHints, normalizeDismissStorage, type FeatureHintDismissStorage } from '../../../src/shared/ui/feature-hint-catalog';
import { getFeatureHintDismissKey } from '../../../src/shared/ui/feature-hint-dismiss';
import { HOST_ID as QR_DIALOG_ID } from '../../../src/shared/ui/community-qr-dialog';
import { EDGE_ADDONS_EXTENSION_ID, FALLBACK_LINKS, getStoreListing } from '../../../src/platform/community-links';
import { engagementNoticeState, language, updateNoticeEnabled, updateNoticeState } from '../../../src/domain/settings';

// The New Tab's ways to Lumno's community and store: the engagement prompt,
// the wordmark, and the Help Center search's WeChat group.

const SEARCH_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';

interface PageOptions {
  language?: string;
  meaningfulUses?: number;
  sync?: Record<string, unknown>;
  runtimeId?: string;
  respond?(message: { action?: unknown }): unknown;
}

// A browser where every feature hint was dismissed and the New Tab has been
// used enough to invite (five meaningful searches over four days in a week).
function createUsedBrowser(options: PageOptions = {}): BrowserFake {
  const now = Date.now();
  const day = (offset: number) => new Date(now - offset * DAY_MS).toISOString().slice(0, 10);
  const state = normalizeEngagementState(null);
  state.newtab = {
    activeDays: [day(7), day(5), day(3), day(1)],
    firstSeenAt: now - 8 * DAY_MS,
    meaningfulUses: options.meaningfulUses ?? 5,
    opens: 8
  };
  const dismissed: Record<FeatureHintDismissStorage, Record<string, boolean>> = { none: {}, sync: {}, local: {}, session: {} };
  listFeatureHints().forEach((hint) => {
    const area = normalizeDismissStorage(hint.dismissStorage);
    dismissed[area][getFeatureHintDismissKey(hint, area)] = true;
  });
  const browser = createBrowserFake({
    sync: {
      [language.key]: options.language || 'en',
      [updateNoticeEnabled.key]: false,
      ...dismissed.sync,
      ...options.sync
    },
    local: { [engagementNoticeState.key]: state, ...dismissed.local },
    tabs: [{ id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true, pinned: false }],
    respond: options.respond
  });
  Object.assign(browser.storage.session.values, dismissed.session);
  if (options.runtimeId) {
    browser.runtime.id = options.runtimeId;
  }
  return browser;
}

function prompt(): HTMLElement | null {
  const found = document.querySelector('.x-lumno-feature-hint[data-engagement-surface="newtab"]');
  return found instanceof HTMLElement ? found : null;
}

function promptVisible(): boolean {
  return prompt()?.getAttribute('data-visible') === 'true';
}

function promptAction(label: string): HTMLElement {
  const action = getElements(prompt() || document, '.x-lumno-feature-hint__action').find((button) => (button.textContent || '').trim() === label);
  if (!action) {
    throw new Error(`Expected the prompt to offer "${label}".`);
  }
  return action;
}

function sentMessages(browser: BrowserFake): Array<Record<string, unknown>> {
  return browser.runtime.sendMessage.mock.calls.map((call) => call[0]).filter(
    (message): message is Record<string, unknown> => typeof message === 'object' && message !== null);
}

function openedTab(browser: BrowserFake): boolean {
  return sentMessages(browser).some((message) => message.action === 'createTab');
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0 }));
  });
  await settle();
}

async function type(text: string): Promise<void> {
  const input = getTag(document, `#${SEARCH_INPUT_ID}`, 'input');
  await act(async () => {
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
}

async function press(key: string): Promise<void> {
  const input = getTag(document, `#${SEARCH_INPUT_ID}`, 'input');
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
  await settle();
}

async function waitPast(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  await settle();
}

async function bootUsedNewtab(browser: BrowserFake): Promise<void> {
  await bootReadyNewtab(browser, { fetch: fetchPackaged });
}

describe('New Tab engagement prompt', () => {
  it('invites an eligible user and opens X in a new tab from its community action', async () => {
    const browser = createUsedBrowser();
    await bootUsedNewtab(browser);
    await waitFor(promptVisible, 'the engagement prompt did not appear');

    await click(promptAction('find us on X'));
    await waitFor(() => openedTab(browser), 'the community action opened nothing');
    expect(sentMessages(browser)).toContainEqual(expect.objectContaining({
      action: 'createTab', url: FALLBACK_LINKS.x, disposition: 'newTab'
    }));
  });

  it('speaks the page language and opens the WeChat QR dialog for Chinese users', async () => {
    const browser = createUsedBrowser({ language: 'zh-CN' });
    await bootUsedNewtab(browser);
    await waitFor(promptVisible, 'the engagement prompt did not appear');
    expect(prompt()?.textContent).toContain(zhCnMessages.engagement_notice_text.message);

    await click(promptAction('进群'));
    await waitFor(() => Boolean(document.getElementById(QR_DIALOG_ID)), 'the QR dialog did not open');
    expect(openedTab(browser)).toBe(false);
  });

  it('stays away from a page where someone searches, and counts the search', async () => {
    const browser = createUsedBrowser({ meaningfulUses: 4 });
    await bootUsedNewtab(browser);
    await type('lumno');
    await waitPast(2400);

    expect(promptVisible()).toBe(false);
    expect(normalizeEngagementState(browser.storage.local.values[engagementNoticeState.key]).newtab.meaningfulUses).toBe(5);
  });

  it('gives the session to a pending update notice', async () => {
    const browser = createUsedBrowser({ sync: { [updateNoticeEnabled.key]: true } });
    browser.storage.sync.values[updateNoticeState.key] = {
      version: browser.runtime.getManifest().version, previousVersion: '0.0.1', reason: 'update', updatedAt: 1
    };
    await bootUsedNewtab(browser);
    const updateVisible = () => getElements(document, '.x-lumno-feature-hint--update-notice')
      .some((hint) => hint.getAttribute('data-visible') === 'true' && !hint.hasAttribute('data-engagement-surface'));
    await waitFor(updateVisible, 'the update notice did not appear');
    await waitPast(2400);

    expect(updateVisible()).toBe(true);
    expect(promptVisible()).toBe(false);
  });
});

describe('New Tab store and community links', () => {
  it('opens the listing of the store the extension came from from the wordmark', async () => {
    const browser = createUsedBrowser({ runtimeId: EDGE_ADDONS_EXTENSION_ID });
    await bootUsedNewtab(browser);
    const wordmark = document.querySelector('[aria-label="Lumno Microsoft Edge Add-ons"]');
    if (!wordmark) {
      throw new Error('Expected the wordmark to name the install channel.');
    }

    await click(wordmark);
    expect(sentMessages(browser)).toContainEqual(expect.objectContaining({
      action: 'createTab', url: getStoreListing(EDGE_ADDONS_EXTENSION_ID).url
    }));
  });

  it.each(['click', 'Enter'])('opens the WeChat QR dialog by %s from an unmatched Help Center search', async (how) => {
    const browser = createUsedBrowser({
      language: 'zh-CN',
      respond: ({ action }) => (action === 'getHelpCenterSearchResults' ? { items: [] } : undefined)
    });
    await bootUsedNewtab(browser);
    await type('lm');
    await press('Tab');
    await type('zzz');
    const rows = () => getElements(document, '.x-nt-suggestion-item');
    const community = () => rows().findIndex((row) => (row.textContent || '').includes('加入反馈群'));
    await waitFor(() => community() > 0, 'an unmatched help search did not offer the WeChat group');

    if (how === 'click') {
      await click(rows()[community()]);
    } else {
      const target = community();
      for (let step = 0; step < target; step += 1) {
        await press('ArrowDown');
      }
      await press('Enter');
    }
    await waitFor(() => Boolean(document.getElementById(QR_DIALOG_ID)), 'the QR dialog did not open');
    expect(openedTab(browser)).toBe(false);
  });
});
