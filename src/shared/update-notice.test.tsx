import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateNoticeEnabled, updateNoticeState } from '../domain/settings/features';
import { createProviderStorageRuntime } from '../platform/provider-storage';
import {
  createUpdateNotice,
  getUpdateNoticeDismissKey,
  getUpdateNoticeDisplayCountKey,
  normalizeUpdateNoticePayload
} from './update-notice';
import type { UpdateNoticeController, UpdateNoticeOptions } from './update-notice';
import type { UpdateNotice } from '../platform/update-notice';
import { createBrowserFake } from '../../tests/fakes/browser';
import type { BrowserFake } from '../../tests/fakes/browser';
import { getElement, required } from '../../tests/fakes/dom';
import { getTestPortals } from '../../tests/fakes/portals';

const fallback = (_key: string, text: string) => text;
const published = normalizeUpdateNoticePayload({
  version: '0.9.10',
  previousVersion: '0.9.9',
  title: 'Release title from GitHub',
  releaseUrl: 'https://example.com/release/?version=v0.9.10',
  reason: 'update',
  updatedAt: 10
});
let notices: UpdateNoticeController[] = [];

function createChrome(sync: Record<string, unknown>, version = '0.9.10'): BrowserFake {
  const chromeApi = createBrowserFake({ sync });
  chromeApi.runtime.getManifest = () => ({ version, manifest_version: 3 });
  return chromeApi;
}

function createNotice(chromeApi: BrowserFake, options: Partial<Omit<UpdateNoticeOptions, 'portals' | 'chromeApi'>> = {}): UpdateNoticeController {
  const made: { notice: UpdateNoticeController | null } = { notice: null };
  act(() => {
    made.notice = createUpdateNotice({ portals: getTestPortals(), chromeApi, t: fallback, ...options });
  });
  const created = required(made.notice, 'update notice');
  notices.push(created);
  document.body.appendChild(created.element);
  return created;
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < 6; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function visible(notice: UpdateNoticeController): string | null {
  return notice.element.getAttribute('data-visible');
}

afterEach(() => {
  act(() => notices.forEach((notice) => notice.destroy()));
  notices = [];
});

describe('update notice', () => {
  it('gives each release its own dismissal', () => {
    const key = getUpdateNoticeDismissKey('0.9.10');
    expect(key).toContain('update_notice');
    expect(key).not.toBe(getUpdateNoticeDismissKey('0.9.11'));
  });

  it('shows the current release, claims the session slot once and opens the details', async () => {
    const chromeApi = createChrome({ [updateNoticeState.key]: published });
    const opened: Array<{ notice: UpdateNotice | null; button: number }> = [];
    const onSessionSlotClaimed = vi.fn();
    const first = createNotice(chromeApi, {
      t: (key, text) => (key === 'update_notice_badge' ? '🦋 已更新至 {version}' : text),
      onSessionSlotClaimed,
      onDetailsClick: (notice, event) => opened.push({ notice, button: event.button })
    });
    const second = createNotice(chromeApi);
    expect(first.hasSessionSlot()).toBe(false);

    expect(await first.ready).toBe(true);
    await settle();
    expect(visible(first)).toBe('true');
    expect(first.hasSessionSlot()).toBe(true);
    expect(onSessionSlotClaimed).toHaveBeenCalledTimes(1);
    expect(getElement(first.element, '.x-lumno-feature-hint__badge-icon[data-icon-type="text"]').textContent).toBe('🦋');
    expect(getElement(first.element, '.x-lumno-feature-hint__badge-text').textContent).toBe('已更新至 0.9.10');
    expect(getElement(first.element, '.x-lumno-feature-hint__text').textContent).toBe('Release title from GitHub');
    const details = getElement(first.element, '.x-lumno-feature-hint__link');
    expect(details.textContent).toBe('更新日志');

    act(() => details.click());
    expect(opened).toHaveLength(1);
    expect(opened[0].notice?.version).toBe('v0.9.10');
    act(() => {
      details.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    });
    expect(opened).toHaveLength(2);
    expect(opened[1].button).toBe(1);

    act(() => first.dismiss());
    await settle();
    expect(first.hasSessionSlot()).toBe(true);
    expect(chromeApi.storage.sync.values[getUpdateNoticeDismissKey('0.9.10')]).toBe(true);
    expect(visible(second)).toBe('false');

    const later = createNotice(chromeApi);
    expect(await later.ready).toBe(false);
    expect(later.hasSessionSlot()).toBe(false);
  });

  it('follows the on/off switch, leaving the session slot free while off', async () => {
    const chromeApi = createChrome({ [updateNoticeState.key]: published, [updateNoticeEnabled.key]: false });
    const notice = createNotice(chromeApi);
    await settle();
    expect(visible(notice)).toBe('false');
    expect(await notice.ready).toBe(false);

    await act(async () => {
      chromeApi.storage.sync.externalSet({ [updateNoticeEnabled.key]: true });
    });
    await settle();
    expect(visible(notice)).toBe('true');
    await act(async () => {
      chromeApi.storage.sync.externalSet({ [updateNoticeEnabled.key]: false });
    });
    await settle();
    expect(visible(notice)).toBe('false');
  });

  it('stays hidden on a version the notice was not published for', async () => {
    const notice = createNotice(createChrome({ [updateNoticeState.key]: published }, '0.9.9'));
    await settle();
    expect(visible(notice)).toBe('false');
  });

  it('looks up a missing release title and saves it for every surface', async () => {
    const untitled = normalizeUpdateNoticePayload({ version: '0.9.10', previousVersion: '0.9.9', reason: 'update', updatedAt: 11 });
    const chromeApi = createChrome({ [updateNoticeState.key]: untitled });
    const notice = createNotice(chromeApi, {
      fetchImpl: async () => ({ ok: true, json: async () => ({ tag_name: '0.9.10', name: 'Minor Bug Fixes' }) })
    });
    await settle();
    expect(getElement(notice.element, '.x-lumno-feature-hint__text').textContent).toBe('Minor Bug Fixes');
    expect(chromeApi.storage.sync.values[updateNoticeState.key]).toMatchObject({ title: 'Minor Bug Fixes' });
  });

  it('counts three showings across New Tab and the overlay, then stays closed', async () => {
    const chromeApi = createChrome({ [updateNoticeState.key]: published });
    const countKey = getUpdateNoticeDisplayCountKey('0.9.10');
    const show = async (surface: string) => {
      const notice = createNotice(chromeApi, { surface });
      const recorded = notice.recordExposure();
      await notice.ready;
      const counted = await recorded;
      await settle();
      return { notice, counted };
    };

    const first = await show('newtab');
    expect(first.counted).toBe(true);
    expect(chromeApi.storage.sync.values[countKey]).toBe(1);
    expect(await first.notice.recordExposure()).toBe(false);
    expect(chromeApi.storage.sync.values[countKey]).toBe(1);
    act(() => first.notice.destroy());

    const second = await show('overlay');
    expect(second.counted).toBe(true);
    expect(chromeApi.storage.sync.values[countKey]).toBe(2);
    act(() => second.notice.destroy());

    const third = await show('newtab');
    expect(third.counted).toBe(true);
    expect(chromeApi.storage.sync.values[countKey]).toBe(3);
    expect(chromeApi.storage.sync.values[getUpdateNoticeDismissKey('0.9.10')]).toBe(true);
    expect(visible(third.notice)).toBe('true');
    act(() => third.notice.destroy());

    const fourth = await show('overlay');
    expect(fourth.counted).toBe(false);
    expect(fourth.notice.getDisplayCount()).toBe(3);
    expect(visible(fourth.notice)).toBe('false');
  });

  it('stops following storage once destroyed', async () => {
    const chromeApi = createChrome({ [updateNoticeState.key]: published });
    // The page's storage mode listener stays for the page's lifetime.
    createProviderStorageRuntime(chromeApi);
    const added = vi.spyOn(chromeApi.storage.onChanged, 'addListener');
    const first = createNotice(chromeApi);
    const second = createNotice(chromeApi);
    await settle();
    expect(added).toHaveBeenCalled();
    act(() => {
      first.destroy();
      second.destroy();
    });
    added.mock.calls.forEach(([listener]) => expect(chromeApi.storage.onChanged.hasListener(listener)).toBe(false));
  });
});
