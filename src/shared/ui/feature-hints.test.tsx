import { act } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createFeatureHint } from './feature-hints';
import { getFeatureHint } from './feature-hint-catalog';
import type { FeatureHintController, FeatureHintOptions } from './feature-hint-catalog';
import {
  getFeatureHintLocalDismissKey,
  getFeatureHintSyncDismissKey
} from './feature-hint-dismiss';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { getElement, required } from '../../../tests/fakes/dom';
import { getTestPortals } from '../../../tests/fakes/portals';

const fallback = (_key: string, text: string) => text;
let hints: FeatureHintController[] = [];

function createHint(options: Omit<FeatureHintOptions, 'portals'>): FeatureHintController {
  const made: { hint: FeatureHintController | null } = { hint: null };
  act(() => {
    made.hint = createFeatureHint({ portals: getTestPortals(), t: fallback, ...options });
  });
  const created = required(made.hint, 'feature hint');
  hints.push(created);
  document.body.appendChild(created.element);
  return created;
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < 4; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function visible(hint: FeatureHintController): string | null {
  return hint.element.getAttribute('data-visible');
}

function createObserverWindow() {
  const window = {
    disconnects: 0,
    ResizeObserver: class implements ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {
        window.disconnects += 1;
      }
    }
  };
  return window;
}

// Chrome's elements have inert; JSDOM's do not.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true, writable: true, value: false });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'inert');
});

afterEach(() => {
  act(() => hints.forEach((hint) => hint.destroy()));
  hints = [];
});

describe('feature hints', () => {
  it('writes the tab switcher shortcut the way each platform does', () => {
    const mac = createHint({ definition: 'newtab-tab-switcher', dismissStorage: 'none', navigatorLike: { userAgentData: { platform: 'macOS' } } });
    const windows = createHint({ definition: 'newtab-tab-switcher', dismissStorage: 'none', navigatorLike: { userAgentData: { platform: 'Windows' } } });
    expect(getElement(mac.element, '.x-lumno-feature-hint__text').textContent).toMatch(/⌥Q/);
    expect(getElement(windows.element, '.x-lumno-feature-hint__text').textContent).toMatch(/Alt\+Q/);
  });

  it('shows once storage loads, remembers the showing in sync and hides on dismiss', async () => {
    const chromeApi = createBrowserFake();
    const observerWindow = createObserverWindow();
    const hint = createHint({ definition: 'newtab-ai-quick-jump', chromeApi, windowObj: observerWindow });
    expect(hint.ready).toBeInstanceOf(Promise);
    expect(await hint.ready).toBe(true);
    await settle();

    expect(visible(hint)).toBe('true');
    expect(hint.element.getAttribute('aria-hidden')).toBe('false');
    expect(hint.element.inert).toBe(false);
    expect(hint.element.getAttribute('data-rounded-arrow-tip')).toBe('true');
    const tip = required(hint.element.firstElementChild, 'arrow tip');
    expect(tip.className).toBe('x-lumno-feature-hint__arrow-tip');
    expect(tip.getAttribute('aria-hidden')).toBe('true');
    const syncKey = getFeatureHintSyncDismissKey('newtab-ai-quick-jump');
    expect(chromeApi.storage.sync.values[syncKey]).toBe(true);
    expect(chromeApi.storage.local.values[getFeatureHintLocalDismissKey('newtab-ai-quick-jump')]).toBeUndefined();

    const close = getElement(hint.element, '.x-lumno-feature-hint__close');
    close.focus();
    expect(document.activeElement).toBe(close);
    act(() => hint.dismiss());
    expect(document.activeElement).not.toBe(close);
    expect(visible(hint)).toBe('false');
    expect(hint.element.getAttribute('aria-hidden')).toBe('true');
    expect(hint.element.inert).toBe(true);
    expect(observerWindow.disconnects).toBe(1);

    const later = createHint({ definition: 'newtab-ai-quick-jump', chromeApi });
    expect(await later.ready).toBe(false);
    await settle();
    expect(visible(later)).toBe('false');
    expect(later.element.getAttribute('data-dismissed')).toBe('true');
  });

  it('shows a hint introduced again after an upgrade and remembers it only when dismissed', async () => {
    const chromeApi = createBrowserFake({
      sync: { [getFeatureHintSyncDismissKey({ ...required(getFeatureHint('newtab-webdav-sync')), introducedIn: '0.9.57' })]: true }
    });
    const key = getFeatureHintSyncDismissKey('newtab-webdav-sync');
    const hint = createHint({ definition: 'newtab-webdav-sync', chromeApi });
    expect(await hint.ready).toBe(true);
    await settle();
    expect(visible(hint)).toBe('true');
    expect(chromeApi.storage.sync.values[key]).toBeUndefined();

    act(() => {
      hint.setVisible(false);
      hint.setVisible(true);
    });
    await settle();
    expect(chromeApi.storage.sync.values[key]).toBeUndefined();

    act(() => hint.dismiss());
    await settle();
    expect(chromeApi.storage.sync.values[key]).toBe(true);

    const later = createHint({ definition: 'newtab-webdav-sync', chromeApi });
    expect(await later.ready).toBe(false);
    expect(later.element.getAttribute('data-dismissed')).toBe('true');
  });

  it('waits for its visibility gate before showing and settling ready', async () => {
    let release: (value?: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const hint = createHint({ definition: 'newtab-webdav-sync', dismissStorage: 'none', visibilityGate: gate });
    expect(visible(hint)).toBe('false');
    let settled = false;
    void hint.ready.then(() => {
      settled = true;
    });
    await settle();
    expect(settled).toBe(false);

    release();
    expect(await hint.ready).toBe(true);
    expect(visible(hint)).toBe('true');
  });

  it('honours a dismissal older versions kept on the device and moves it to sync', async () => {
    const chromeApi = createBrowserFake({ local: { [getFeatureHintLocalDismissKey('newtab-ai-quick-jump')]: true } });
    const hint = createHint({ definition: 'newtab-ai-quick-jump', chromeApi });
    await settle();
    expect(hint.element.getAttribute('data-dismissed')).toBe('true');
    expect(chromeApi.storage.sync.values[getFeatureHintSyncDismissKey('newtab-ai-quick-jump')]).toBe(true);
  });

  it('draws the rounded arrow tip only for hints that ask for it', () => {
    const hint = createHint({
      definition: {
        id: 'plain-feature-hint',
        introducedIn: '0.0.0',
        surface: 'test',
        placement: 'test',
        arrowSide: 'bottom',
        arrowAlign: 'center',
        dismissStorage: 'none',
        badgeKey: '',
        badgeFallback: 'New',
        textKey: '',
        textFallback: 'Plain feature hint',
        closeLabelKey: '',
        closeLabelFallback: 'Dismiss plain feature hint'
      }
    });
    expect(hint.element.getAttribute('data-rounded-arrow-tip')).toBe('false');
    expect(hint.element.querySelector('.x-lumno-feature-hint__arrow-tip')).toBeNull();
  });

  it('settles hidden when destroyed before storage answers, and ignores the late answer', async () => {
    const chromeApi = createBrowserFake();
    const pending: { answer: (() => void) | null } = { answer: null };
    chromeApi.storage.sync.get = (_keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
      pending.answer = () => callback?.({});
      return undefined;
    };
    const hint = createHint({ definition: 'newtab-ai-quick-jump', chromeApi });
    act(() => hint.destroy());
    expect(await hint.ready).toBe(false);
    await settle();
    required(pending.answer, 'the pending storage read')();
    await settle();
    expect(visible(hint)).toBe('false');
  });
});
