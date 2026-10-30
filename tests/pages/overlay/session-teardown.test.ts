import { describe, expect, it } from 'vitest';
import { bootOverlayPage, settle, waitFor, type OverlayPage } from './boot';
import { required } from '../../fakes/dom';

// Every way of closing the overlay (a later toggle, Escape, the replacement
// of a stale overlay) releases what its session added to the page.

const MOTION_KEY = '_x_extension_motion_effects_enabled_2026_unique_';

async function openAndSettle(page: OverlayPage): Promise<HTMLElement> {
  await page.open();
  expect(page.listeners().length).toBeGreaterThan(0);
  expect(page.sessionStorageListenerCount()).toBeGreaterThan(0);
  return required(page.host(), 'the overlay host');
}

function expectReleased(page: OverlayPage, baseline: string[]): void {
  expect(page.listeners()).toEqual(baseline);
  expect(page.sessionStorageListenerCount()).toBe(0);
  expect(page.mediaListeners.size).toBe(0);
  expect(page.overlayOpen()).toBe(false);
}

const waitForClosed = (page: OverlayPage, message: string) => waitFor(() => page.hostCount() === 0, message);
const panelOf = (page: OverlayPage) => required(page.panel(), 'the overlay panel');

async function openWithMotion() {
  const page = await bootOverlayPage({ settings: { [MOTION_KEY]: true } });
  const baseline = page.listeners();
  await openAndSettle(page);
  await waitFor(() => panelOf(page).getAttribute('data-lumno-overlay-entry') === 'done', 'the entry did not finish');
  return { page, baseline };
}

describe('Overlay session teardown', () => {
  it('closes from a later toggle after its exit and releases the first session', async () => {
    const { page, baseline } = await openWithMotion();

    page.toggle();
    expect(panelOf(page).getAttribute('data-lumno-overlay-exit')).toBe('running');
    await waitForClosed(page, 'the second press did not close the overlay');
    expectReleased(page, baseline);
  });

  it('closes at once without motion effects, by toggle and by Escape', async () => {
    const page = await bootOverlayPage();
    const baseline = page.listeners();
    await openAndSettle(page);
    page.toggle();
    expect(page.hostCount()).toBe(0);
    expectReleased(page, baseline);

    await openAndSettle(page);
    page.press('Escape');
    expect(page.hostCount()).toBe(0);
    expectReleased(page, baseline);
  });

  it('releases input as soon as the exit starts', async () => {
    const { page } = await openWithMotion();
    await page.type('hello');

    page.press('Escape');
    const panel = panelOf(page);
    expect(panel.getAttribute('data-lumno-overlay-exit')).toBe('running');
    expect(page.overlayOpen()).toBe(false);
    expect(panel.inert).toBe(true);
    expect(page.root()?.activeElement).not.toBe(page.input());

    const before = page.messages.length;
    page.press('Enter');
    await settle(30);
    expect(page.messages.slice(before).map((message) => message.action)
      .filter((action) => action !== 'notifyOverlayClosed')).toEqual([]);
    await waitForClosed(page, 'the overlay did not close after its exit');
  });

  it.each(['hotkey', 'Escape'])('reopens when the hotkey is pressed during the %s exit', async (startClose) => {
    const { page, baseline } = await openWithMotion();
    const closingHost = page.host();
    if (startClose === 'hotkey') {
      page.toggle();
    } else {
      page.press('Escape');
    }
    expect(panelOf(page).getAttribute('data-lumno-overlay-exit')).toBe('running');

    await openAndSettle(page);
    expect(page.hostCount()).toBe(1);
    expect(page.host()).not.toBe(closingHost);
    expect(panelOf(page).hasAttribute('data-lumno-overlay-exit')).toBe(false);
    expect(page.overlayOpen()).toBe(true);
    await settle(300);
    expect(page.hostCount()).toBe(1);

    page.toggle({ ensureOpen: true });
    expect(page.hostCount()).toBe(1);
    page.toggle();
    await waitForClosed(page, 'the reopened overlay did not close');
    expectReleased(page, baseline);
  });

  it('puts back a host the page removes until the overlay closes', async () => {
    const page = await bootOverlayPage();
    const host = await openAndSettle(page);

    host.remove();
    await waitFor(() => host.isConnected, 'the open overlay host was not put back');
    page.toggle();
    await waitForClosed(page, 'the restored overlay did not close');
    expect(host.isConnected).toBe(false);
    expect(page.hostCount()).toBe(0);
  });

  it('replaces a stale overlay without stacking listeners, then releases them on close', async () => {
    const page = await bootOverlayPage();
    const baseline = page.listeners();
    const firstHost = await openAndSettle(page);
    const listenersWhileOpen = page.listeners();
    const storageListenersWhileOpen = page.sessionStorageListenerCount();

    page.markOverlayFromOtherContext();
    const secondHost = await openAndSettle(page);
    expect(secondHost).not.toBe(firstHost);
    expect(firstHost.isConnected).toBe(false);
    expect(page.hostCount()).toBe(1);
    expect(page.listeners()).toEqual(listenersWhileOpen);
    expect(page.sessionStorageListenerCount()).toBe(storageListenersWhileOpen);

    page.toggle();
    await waitForClosed(page, 'the replacement overlay did not close');
    expectReleased(page, baseline);
  });

  it('releases its listeners over repeated open and close cycles', async () => {
    const page = await bootOverlayPage();
    const baseline = page.listeners();
    await openAndSettle(page);
    page.toggle();
    await waitForClosed(page, 'the first cycle did not close');
    await openAndSettle(page);
    page.toggle();
    await waitForClosed(page, 'the second cycle did not close');
    expectReleased(page, baseline);
  });
});
