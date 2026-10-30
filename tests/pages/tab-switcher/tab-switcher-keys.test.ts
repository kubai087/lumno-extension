import { describe, expect, it } from 'vitest';
import { bootTabSwitcherPage, settle, switcherTabs, type TabSwitcherPage } from './boot';
import { required } from '../../fakes/dom';

// The tab switcher the worker injects into a web page, driven the way the
// user and the worker do: trusted key presses and runtime messages, checked
// by what it shows and which tab it asks the worker to switch to.

const openDefault = (page: TabSwitcherPage, extra: Record<string, unknown> = {}) =>
  page.open({ tabs: switcherTabs(4), shortcut: 'Alt+Q', ...extra });

const switchTo = (tabId: number) => ({ action: 'switchToTab', tabId, windowId: 1 });

describe('Tab switcher opening', () => {
  it('opens on the root element with at most five cards, visible on its first paint', async () => {
    const page = await bootTabSwitcherPage();
    expect(page.open({ tabs: switcherTabs(8), selectedIndex: 1 })).toEqual({ ok: true });
    expect(page.host()?.parentNode).toBe(document.documentElement);
    expect(page.cards()).toHaveLength(5);
    expect(page.selectedIndex()).toBe(1);
    expect(page.panel()?.getAttribute('data-visible')).toBe('true');
    const shadow = required(page.shadow(), 'the switcher shadow root');
    expect(shadow.querySelector('.x-tab-switcher-title')).toBeNull();
    expect(shadow.querySelector('.x-tab-switcher-current')).toBeNull();
    expect(page.cards().every((card) => card.querySelector('.x-tab-switcher-name-row .x-tab-switcher-title-favicon'))).toBe(true);
    expect(page.open({ tabs: [] })).toEqual({ ok: true, reason: 'already-open' });
  });

  it('opens nothing without tabs', async () => {
    const page = await bootTabSwitcherPage();
    expect(page.open({ tabs: [] })).toEqual({ ok: false, reason: 'empty' });
    expect(page.host()).toBeNull();
  });

  it('mounts in a closed shadow root', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    expect(page.host()?.shadowRoot).toBeNull();
  });

  it('advances on a repeated summon, and closes on a plain one', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    expect(page.open({ tabs: switcherTabs(4), advanceOnExisting: true })).toEqual({ ok: true, reason: 'already-open' });
    expect(document.querySelectorAll('#_x_extension_tab_switcher_host_2026_unique_')).toHaveLength(1);
    expect(page.selectedIndex()).toBe(1);
    page.open({ tabs: switcherTabs(4) });
    expect(page.host()).toBeNull();
  });
});

describe('Tab switcher keys', () => {
  it('cycles with Tab and the arrows, wrapping, and keeps handled keys from the page', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    const pageKeys: string[] = [];
    document.addEventListener('keydown', (event) => pageKeys.push(event.key));

    const tab = page.press('Tab');
    expect(page.selectedIndex()).toBe(1);
    expect(tab.defaultPrevented).toBe(true);
    page.press('Tab', { shiftKey: true });
    expect(page.selectedIndex()).toBe(0);
    page.press('ArrowLeft');
    expect(page.selectedIndex()).toBe(3);
    page.press('ArrowDown');
    expect(page.selectedIndex()).toBe(0);
    page.press('ArrowRight');
    page.press('ArrowUp');
    page.press('ArrowRight');
    expect(page.selectedIndex()).toBe(1);
    expect(pageKeys).toEqual([]);
  });

  it('switches to the selected tab on Enter, and ignores untrusted keys', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    page.press('Tab');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(page.selectedIndex()).toBe(1);
    expect(page.lastSwitch()).toBeNull();

    page.press('Enter');
    expect(page.lastSwitch()).toEqual(switchTo(2));
  });

  it('closes on Escape without switching and stops listening for keys', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    page.press('Escape');
    expect(page.host()).toBeNull();
    expect(page.lastSwitch()).toBeNull();
    expect(page.listenerCount('keydown')).toBe(0);
    expect(page.listenerCount('keyup')).toBe(0);
  });

  it('ignores synthetic keys and clicks, which never switch tabs', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { tabs: switcherTabs(3) });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }));
    page.cards()[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle(30);
    expect(page.switches()).toEqual([]);
    expect(page.host()).not.toBeNull();
  });

  it('suppresses the key still held from the summon until it is released, then switches on Alt', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { suppressInitialShortcutAdvance: true });
    const repeat = page.press('q', { code: 'KeyQ', altKey: true, repeat: true });
    expect(page.selectedIndex()).toBe(0);
    expect(repeat.defaultPrevented).toBe(true);
    page.release('q', { code: 'KeyQ', altKey: true });
    expect(page.host()).not.toBeNull();
    page.press('q', { code: 'KeyQ', altKey: true });
    expect(page.selectedIndex()).toBe(1);
    page.press('q', { code: 'KeyQ', altKey: true });
    expect(page.selectedIndex()).toBe(2);

    page.release('Alt', { code: 'AltLeft' });
    await settle();
    expect(page.lastSwitch()).toEqual(switchTo(3));
    expect(page.host()).toBeNull();
  });

  it.each([
    ['after Alt was already released', { code: 'KeyQ', altKey: false }],
    ['when the summoning press was released before the panel opened', { code: 'KeyQ', altKey: true }]
  ])('advances on a new press %s', async (_case, init) => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { suppressInitialShortcutAdvance: true });
    page.press('q', init);
    expect(page.selectedIndex()).toBe(1);
  });

  it('cycles on held presses after a repeated command advanced it', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { suppressInitialShortcutAdvance: true });
    page.message({ action: 'advanceOpenTabSwitcherFromCommand', offset: 1 });
    expect(page.selectedIndex()).toBe(1);
    page.press('q', { code: 'KeyQ', altKey: true });
    expect(page.selectedIndex()).toBe(2);
  });

  it('cycles on the shortcut key at once without the summon flag', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    page.press('q', { code: 'KeyQ', altKey: true });
    expect(page.selectedIndex()).toBe(1);
  });

  it('moves back when Shift is added to the shortcut, and forward when dropped from the reverse one', async () => {
    const forward = await bootTabSwitcherPage();
    openDefault(forward, { shortcut: '⌃Q', selectedIndex: 1 });
    forward.press('Q', { code: 'KeyQ', ctrlKey: true, shiftKey: true });
    expect(forward.selectedIndex()).toBe(0);
    forward.press('q', { code: 'KeyQ', ctrlKey: true });
    expect(forward.selectedIndex()).toBe(1);
    forward.press('Escape');

    openDefault(forward, { shortcut: '⌃⇧Q', reverse: true, selectedIndex: 3 });
    forward.press('Q', { code: 'KeyQ', ctrlKey: true, shiftKey: true });
    expect(forward.selectedIndex()).toBe(2);
    forward.press('q', { code: 'KeyQ', ctrlKey: true });
    expect(forward.selectedIndex()).toBe(3);
  });

  // Ctrl+Tab can only be bound from the browser's shortcuts page console;
  // macOS reports it as ⌃⇥, and Tab then follows the shortcut's rules.
  it('cycles a Ctrl+Tab shortcut like its shortcut key and switches on the Control release', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { shortcut: '⌃⇥', suppressInitialShortcutAdvance: true });
    page.press('Tab', { code: 'Tab', ctrlKey: true, repeat: true });
    expect(page.selectedIndex()).toBe(0);
    page.release('Tab', { code: 'Tab', ctrlKey: true });
    page.press('Tab', { code: 'Tab', ctrlKey: true });
    expect(page.selectedIndex()).toBe(1);
    page.release('Control', { code: 'ControlLeft' });
    await settle();
    expect(page.lastSwitch()).toEqual(switchTo(2));
  });

  it('reverses a Ctrl+Shift+Tab shortcut when Shift is dropped', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { shortcut: 'Ctrl+Shift+Tab', reverse: true, selectedIndex: 3 });
    page.press('Tab', { code: 'Tab', ctrlKey: true, shiftKey: true });
    expect(page.selectedIndex()).toBe(2);
    page.press('Tab', { code: 'Tab', ctrlKey: true });
    expect(page.selectedIndex()).toBe(3);
  });

  it('matches a custom shortcut by key code and switches only on its primary modifier release', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { shortcut: 'Ctrl+Shift+/' });
    page.press('?', { code: 'Slash', ctrlKey: true, shiftKey: true });
    expect(page.selectedIndex()).toBe(1);
    page.release('Shift', { code: 'ShiftLeft', ctrlKey: true });
    page.release('?', { code: 'Slash', ctrlKey: true });
    await settle();
    expect(page.lastSwitch()).toBeNull();
    page.release('Control', { code: 'ControlLeft' });
    await settle();
    expect(page.lastSwitch()).toEqual(switchTo(2));
  });

  it('keeps a Command shortcut open on its trigger key release and switches once on the Command release', async () => {
    const page = await bootTabSwitcherPage();
    page.toggle({ tabs: [{ id: 1, title: 'Source' }, { id: 2, title: 'Target' }], shortcut: 'Command+1', suppressInitialShortcutAdvance: true });
    page.message({ action: 'advanceOpenTabSwitcherFromCommand', offset: 1 });
    page.release('1', { code: 'Digit1' });
    expect(page.host()).not.toBeNull();
    expect(page.switches()).toEqual([]);

    page.release('Meta', { code: 'MetaLeft' });
    expect(page.switches()).toEqual([{ action: 'switchToTab', tabId: 2, windowId: null }]);
    await settle();
    expect(page.host()).toBeNull();
  });
});

describe('Tab switcher messages', () => {
  it('reports no switcher before one opens', async () => {
    const page = await bootTabSwitcherPage();
    expect(page.message({ action: 'advanceOpenTabSwitcherFromCommand', offset: 1 }))
      .toEqual({ ok: true, open: false, advanced: false, suppressed: false });
    expect(page.message({ action: 'commitOpenTabSwitcherFromShortcutRelease' })).toEqual({ ok: false, committed: false });
    expect(page.message({ action: 'updateTabSwitcherThumbnail', tabId: 1 })).toEqual({ ok: false, reason: 'tab_switcher_host_missing' });
  });

  it('opens, advances, takes a fresh capture and commits through the runtime already in the page', async () => {
    const page = await bootTabSwitcherPage();
    expect(page.message({ action: 'openTabSwitcherFromCommand', context: { tabs: switcherTabs(3) } })).toEqual({ ok: true });
    expect(page.cards()).toHaveLength(3);
    expect(page.message({ action: 'advanceOpenTabSwitcherFromCommand', offset: 1 }))
      .toEqual({ ok: true, open: true, advanced: true, suppressed: false });
    expect(page.selectedIndex()).toBe(1);
    page.message({ action: 'advanceOpenTabSwitcherFromCommand', offset: -1 });
    expect(page.selectedIndex()).toBe(0);

    const card = page.cards()[1];
    const thumbnail = 'data:image/png;base64,bmV3';
    expect(page.message({ action: 'updateTabSwitcherThumbnail', tabId: 2, url: 'https://site2.example.test/', thumbnail, thumbnailStatus: 'ok' }))
      .toMatchObject({ ok: true });
    await settle(40);
    expect(Array.from(card.querySelectorAll('img[data-kind="thumbnail"]'), (img) => img.getAttribute('src'))).toContain(thumbnail);

    page.message({ action: 'advanceOpenTabSwitcherFromCommand', offset: 1 });
    // A release relayed from another frame or tab.
    expect(page.message({ action: 'commitOpenTabSwitcherFromShortcutRelease' })).toEqual({ ok: true, committed: true });
    await settle();
    expect(page.lastSwitch()).toEqual(switchTo(2));
    expect(page.message({ action: 'openTabSwitcherFromCommand', context: { tabs: switcherTabs(2) } })).toEqual({ ok: true });
  });

  it('listens for the worker\'s messages once', async () => {
    const page = await bootTabSwitcherPage();
    expect(page.messageListenerCount()).toBe(1);
  });

  it('switches through a trusted activation of a card', async () => {
    const page = await bootTabSwitcherPage();
    page.toggle({ tabs: [{ id: 1, title: 'Trusted pointer target' }], shortcut: 'Alt+Q' });
    page.press('Enter');
    expect(page.switches()).toEqual([{ action: 'switchToTab', tabId: 1, windowId: null }]);
  });
});

describe('Tab switcher page bridge on a web page', () => {
  it('opens no port to the worker', async () => {
    const page = await bootTabSwitcherPage({ bridge: true });
    expect(page.connect).not.toHaveBeenCalled();
  });
});
