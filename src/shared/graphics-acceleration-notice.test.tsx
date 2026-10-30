import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphicsProbe } from '../domain/settings/features';
import type { GraphicsRendering } from '../domain/settings/features';
import { createGraphicsNotice, createGraphicsNoticeDefinition } from './graphics-acceleration-notice';
import type { GraphicsNoticeController, GraphicsNoticeOptions } from './graphics-acceleration-notice';
import { getFeatureHintLocalDismissKey } from './ui/feature-hint-dismiss';
import { createBrowserFake } from '../../tests/fakes/browser';
import type { BrowserFake } from '../../tests/fakes/browser';
import { getElement, required } from '../../tests/fakes/dom';
import { getTestPortals } from '../../tests/fakes/portals';

const DISMISS_KEY = getFeatureHintLocalDismissKey(createGraphicsNoticeDefinition('newtab'));
let notices: GraphicsNoticeController[] = [];

function createChrome(rendering: GraphicsRendering, local: Record<string, unknown> = {}): BrowserFake {
  return createBrowserFake({ local: { [graphicsProbe.key]: { rendering, checkedAt: 1 }, ...local } });
}

function createNotice(chromeApi: BrowserFake, options: Partial<Omit<GraphicsNoticeOptions, 'portals' | 'chromeApi'>> = {}): GraphicsNoticeController {
  const made: { notice: GraphicsNoticeController | null } = { notice: null };
  act(() => {
    made.notice = createGraphicsNotice({
      portals: getTestPortals(),
      chromeApi,
      surface: 'newtab',
      t: (_key, text) => text,
      checkRendering: async () => 'software',
      ...options
    });
  });
  const created = required(made.notice, 'graphics notice');
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

afterEach(() => {
  act(() => notices.forEach((notice) => notice.destroy()));
  notices = [];
  vi.unstubAllGlobals();
});

describe('graphics acceleration notice', () => {
  it('shows when the stored and a fresh probe both find software rendering, taking the session slot', async () => {
    const onSessionSlotClaimed = vi.fn();
    const notice = createNotice(createChrome('software'), { onSessionSlotClaimed });
    expect(await notice.ready).toBe(true);
    expect(notice.isVisible()).toBe(true);
    expect(notice.hasSessionSlot()).toBe(true);
    expect(onSessionSlotClaimed).toHaveBeenCalledTimes(1);
    expect(notice.element.textContent).toContain('Graphics acceleration is off');
  });

  it('opens the setting and hides for this page view only', async () => {
    const chromeApi = createChrome('software');
    const onOpenSettings = vi.fn();
    const notice = createNotice(chromeApi, { onOpenSettings });
    await notice.ready;
    act(() => getElement(notice.element, '.x-lumno-feature-hint__link').click());
    await settle();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(notice.isVisible()).toBe(false);
    expect(chromeApi.storage.local.values[DISMISS_KEY]).toBeUndefined();

    const again = createNotice(chromeApi);
    expect(await again.ready).toBe(true);
  });

  it('stays closed on this computer once closed', async () => {
    const chromeApi = createChrome('software');
    const notice = createNotice(chromeApi);
    await notice.ready;
    act(() => getElement(notice.element, '.x-lumno-feature-hint__close').click());
    await settle();
    expect(notice.isVisible()).toBe(false);
    expect(chromeApi.storage.local.values[DISMISS_KEY]).toBe(true);

    const later = createNotice(createChrome('software', { [DISMISS_KEY]: true }));
    expect(await later.ready).toBe(false);
    expect(later.isVisible()).toBe(false);
  });

  it('hides when the GPU is back after a restart', async () => {
    const chromeApi = createChrome('software');
    const notice = createNotice(chromeApi);
    await notice.ready;
    await act(async () => {
      chromeApi.storage.local.externalSet({ [graphicsProbe.key]: { rendering: 'hardware', checkedAt: 2 } });
    });
    await settle();
    expect(notice.isVisible()).toBe(false);
  });

  it('shows nothing when a fresh probe finds the GPU or cannot tell', async () => {
    const found = createNotice(createChrome('software'), { checkRendering: async () => 'hardware' });
    const unsure = createNotice(createChrome('software'), { checkRendering: async () => 'unknown' });
    expect(await found.ready).toBe(false);
    expect(await unsure.ready).toBe(false);
    expect(found.isVisible()).toBe(false);
    expect(unsure.isVisible()).toBe(false);
  });

  it('does not probe again when the stored answer is the GPU', async () => {
    const checkRendering = vi.fn(async (): Promise<GraphicsRendering> => 'software');
    const notice = createNotice(createChrome('hardware'), { checkRendering });
    expect(await notice.ready).toBe(false);
    expect(checkRendering).not.toHaveBeenCalled();
    expect(notice.hasSessionSlot()).toBe(false);
  });

  it('waits while the page has something else to show', async () => {
    const notice = createNotice(createChrome('software'), { canShow: () => false });
    expect(await notice.ready).toBe(false);
    expect(notice.isVisible()).toBe(false);
  });

  it("asks the worker for a fresh probe by default", async () => {
    const chromeApi = createBrowserFake({
      local: { [graphicsProbe.key]: { rendering: 'software', checkedAt: 1 } },
      respond: (message) => (message.action === 'checkGraphicsRendering' ? { rendering: 'software' } : undefined)
    });
    vi.stubGlobal('chrome', chromeApi);
    const made: { notice: GraphicsNoticeController | null } = { notice: null };
    act(() => {
      made.notice = createGraphicsNotice({ portals: getTestPortals(), chromeApi, surface: 'newtab' });
    });
    const created = required(made.notice, 'graphics notice');
    notices.push(created);
    expect(await created.ready).toBe(true);
    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'checkGraphicsRendering' }), expect.any(Function));
  });

  it('speaks the page language', async () => {
    const notice = createNotice(createChrome('software'), {
      t: (key, text) => (key === 'graphics_notice_badge' ? '图形加速已关闭' : text)
    });
    await notice.ready;
    expect(notice.element.textContent).toContain('图形加速已关闭');
  });
});
