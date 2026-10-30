import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { newtabOpenInNewTab } from '../../../src/domain/settings/newtab-page';
import {
  NEWTAB_SHORTCUT_SIZE_MAX,
  NEWTAB_SHORTCUT_SIZE_MIN,
  newtabShortcutAddVisible,
  newtabShortcutColumns,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutSize,
  newtabShortcutWidth,
  newtabShortcutsVisible
} from '../../../src/domain/settings/newtab-shortcuts';
import { createShortcutStoragePlan } from '../../../src/domain/shortcuts/storage-plan';
import { createBrowserFake } from '../../fakes/browser';
import { getElement, getElementById, getElements } from '../../fakes/dom';
import { bootReadyNewtab, settle } from './boot';
import { openDragPage, type DragPage } from './drag-page';

// The shortcut tiles on New Tab: how they open, show and hide, magnify like a
// dock, label themselves, follow other devices, and lay out from the grid
// settings.

const SECTION_ID = '_x_extension_newtab_shortcuts_2026_unique_';
const TOOLTIP_ID = '_x_extension_newtab_shortcut_tooltip_2026_unique_';
const SITES = [
  { url: 'chrome://inspect/#devices', title: 'Inspect' },
  { url: 'https://one.example/', title: 'One' },
  { url: 'https://two.example/', title: 'Two' }
];

function click(element: Element, init: MouseEventInit = {}): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
}

function createdTabs(newtab: DragPage): Array<[unknown, unknown]> {
  return newtab.browser.runtime.sendMessage.mock.calls.flatMap(([message]) => (
    typeof message === 'object' && message !== null && 'action' in message && message.action === 'createTab' &&
      'url' in message && 'disposition' in message ? [[message.url, message.disposition]] : []
  ));
}

describe('opening a shortcut', () => {
  it('opens a browser page in this tab, and in the background from a modified or middle click', async () => {
    const newtab = await openDragPage({ shortcuts: SITES });

    click(newtab.tile('Inspect'));
    await newtab.advance(60);
    expect(newtab.browser.tabs.update.mock.calls.map((call) => call[1])).toEqual([{ url: 'chrome://inspect/#devices' }]);
    click(newtab.tile('Inspect'), { metaKey: true });
    click(newtab.tile('Inspect'), { ctrlKey: true });
    newtab.tile('Inspect').dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    await newtab.advance(60);
    expect(createdTabs(newtab)).toEqual(Array(3).fill(['chrome://inspect/#devices', 'backgroundTab']));
    expect(newtab.browser.tabs.update).toHaveBeenCalledTimes(1);
  });

  it('opens a foreground tab from a plain click with "open in a new tab" on', async () => {
    const newtab = await openDragPage({ shortcuts: SITES, sync: { [newtabOpenInNewTab.key]: { shortcuts: true } } });

    click(newtab.tile('One'));
    click(newtab.tile('One'), { metaKey: true });
    await newtab.advance(60);
    expect(createdTabs(newtab).map(([, disposition]) => disposition)).toEqual(['newTab', 'backgroundTab']);
    expect(newtab.browser.tabs.update).not.toHaveBeenCalled();
  });
});

describe('the shortcut rail', () => {
  it('hides when shortcuts are turned off and comes back at once when they are turned on', async () => {
    const newtab = await openDragPage({ shortcuts: SITES, sync: { [newtabShortcutsVisible.key]: false } });
    expect(getElementById(SECTION_ID).getAttribute('data-visible')).not.toBe('true');

    await act(async () => newtab.browser.storage.sync.externalSet({ [newtabShortcutsVisible.key]: true }));
    await newtab.advance(100);
    expect(getElementById(SECTION_ID).getAttribute('data-visible')).toBe('true');
  });

  it('stays hidden, add tile included, with nothing to show', async () => {
    await openDragPage({ shortcuts: [], sync: { [newtabShortcutAddVisible.key]: false } });

    expect(getElementById(SECTION_ID).getAttribute('data-visible')).not.toBe('true');
    expect(getElement(document, '.x-nt-shortcut-tile--add').hidden).toBe(true);
  });

  it('shows as many shortcuts as the store keeps', async () => {
    const many = Array.from({ length: 60 }, (_, index) => ({ url: `https://site${index}.example/`, title: `Site ${index}` }));
    const newtab = await openDragPage({ shortcuts: many });

    expect(newtab.shortcuts()).toHaveLength(60);
  });

  it('shows shortcuts changed on another device', async () => {
    const newtab = await openDragPage({ shortcuts: SITES });

    await act(async () => newtab.browser.storage.sync.externalSet(
      createShortcutStoragePlan({ items: [{ url: 'https://elsewhere.example/', title: 'Elsewhere' }] }).payload
    ));
    await newtab.advance(200);
    expect(newtab.shortcuts()).toEqual(['Elsewhere']);
  });

  it('starts in a dark system theme with an icon on every tile', async () => {
    const browser = createBrowserFake({ sync: createShortcutStoragePlan({ items: SITES }).payload });
    await bootReadyNewtab(browser, { darkSystem: true });

    const tiles = getElements(document, '.x-nt-shortcut-tile:not(.x-nt-shortcut-tile--add)');
    expect(tiles).toHaveLength(3);
    expect(tiles.every((tile) => tile.querySelector('.x-nt-shortcut-icon'))).toBe(true);
  });
});

describe('dock magnification', () => {
  const distances = () => getElements(document, '.x-nt-shortcut-tile').map((tile) => tile.getAttribute('data-dock-distance'));

  it('marks each neighbour of the hovered tile by its distance and magnifies it, then settles back', async () => {
    const newtab = await openDragPage({ shortcuts: SITES, sync: { [newtabShortcutDockMagnificationEnabled.key]: true } });
    const box = newtab.tile('One').getBoundingClientRect();
    newtab.pointer('pointerover', box.left + 30, box.top + 30);
    newtab.pointer('pointermove', box.left + 30, box.top + 30);
    await newtab.advance(60);

    expect(distances()).toEqual(['1', '0', '1', '2']);
    expect(Number.parseFloat(newtab.tile('One').style.getPropertyValue('--x-nt-shortcut-dock-scale'))).toBeGreaterThan(1);
    const grid = getElement(document, '.x-nt-shortcuts-grid');
    grid.dispatchEvent(new MouseEvent('pointerleave', { clientX: 10, clientY: 10 }));
    await newtab.advance(60);
    expect(distances()).toEqual([null, null, null, null]);
  });

  it('changes nothing on hover when it is off', async () => {
    const newtab = await openDragPage({ shortcuts: SITES, sync: { [newtabShortcutDockMagnificationEnabled.key]: false } });
    const box = newtab.tile('One').getBoundingClientRect();
    newtab.pointer('pointerover', box.left + 30, box.top + 30);
    newtab.pointer('pointermove', box.left + 30, box.top + 30);
    await newtab.advance(60);

    expect(getElement(document, '.x-nt-shortcuts-grid').getAttribute('data-dock-magnification')).toBe('false');
    expect(distances()).toEqual([null, null, null, null]);
  });
});

describe('shortcut labels', () => {
  it('shows a tile\'s title in an anchored tooltip below its icon, not as a label or native title', async () => {
    const newtab = await openDragPage({ shortcuts: SITES });
    expect(document.querySelectorAll('.x-nt-shortcut-title, .x-nt-shortcut-label')).toHaveLength(0);
    const two = newtab.tile('Two');
    expect([two.getAttribute('data-tooltip'), two.getAttribute('title')]).toEqual(['Two', null]);

    const box = two.getBoundingClientRect();
    const at = { clientX: box.left + 30, clientY: box.top + 30 };
    two.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, ...at }));
    two.dispatchEvent(new MouseEvent('pointerenter', at));
    two.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, ...at }));
    two.dispatchEvent(new MouseEvent('mouseenter', at));
    await newtab.advance(300);
    const tooltip = getElementById(TOOLTIP_ID);
    expect([tooltip.getAttribute('data-visible'), tooltip.textContent]).toEqual(['true', 'Two']);
    // The 48px icon sits at the top of its tile.
    expect(Number.parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(box.top + 48);
    expect(getElement(document, '.x-nt-shortcut-tile--add').getAttribute('data-tooltip')).toBe('Add shortcut');
  });

  it('does not let favicon images be dragged on their own', async () => {
    await openDragPage({ shortcuts: SITES });

    expect(getElements(document, '.x-nt-shortcut-tile img').every((image) => image.getAttribute('draggable') !== 'true')).toBe(true);
  });
});

describe('the shortcut grid layout', () => {
  // The grid variables New Tab sets on the root element.
  function layout() {
    const style = document.documentElement.style;
    const px = (name: string) => Number.parseFloat(style.getPropertyValue(name));
    return {
      columns: style.getPropertyValue('--x-nt-shortcut-columns'),
      tile: px('--x-nt-shortcut-user-tile-size'),
      icon: px('--x-nt-shortcut-user-icon-size'),
      favicon: px('--x-nt-shortcut-user-favicon-size')
    };
  }

  it.each([
    ['ten per row on a fresh install', {}, '10'],
    ['the column count an old pixel width stands for', { [newtabShortcutWidth.key]: 1440 }, '16'],
    ['a stored column count over the old width', { [newtabShortcutWidth.key]: 1440, [newtabShortcutColumns.key]: 6 }, '6']
  ])('shows %s', async (_name, sync, columns) => {
    await bootReadyNewtab(createBrowserFake({ sync }));

    expect(layout().columns).toBe(columns);
  });

  it('applies a column count changed in Settings at once', async () => {
    const browser = createBrowserFake({ sync: { [newtabShortcutColumns.key]: 6 } });
    await bootReadyNewtab(browser);

    await act(async () => browser.storage.sync.externalSet({ [newtabShortcutColumns.key]: 12 }));
    await settle();
    expect(layout().columns).toBe('12');
  });

  // Fractional or odd-margin icon sizes snap unevenly on 1x screens and push
  // the favicon off center inside its rounded square.
  it('keeps every icon size on whole pixels, centered with even margins', async () => {
    const browser = createBrowserFake();
    await bootReadyNewtab(browser);
    expect(layout()).toEqual({ columns: '10', tile: 64, icon: 48, favicon: 28 });

    for (let size = NEWTAB_SHORTCUT_SIZE_MIN; size <= NEWTAB_SHORTCUT_SIZE_MAX; size += 1) {
      await act(async () => browser.storage.sync.externalSet({ [newtabShortcutSize.key]: size }));
      await settle(2);
      const { tile, icon, favicon } = layout();
      expect(tile).toBe(size);
      expect(Number.isInteger(icon) && Number.isInteger(favicon)).toBe(true);
      expect((size - icon) % 2).toBe(0);
      expect((icon - favicon) % 2).toBe(0);
      expect(Math.abs(icon - size * 0.75)).toBeLessThanOrEqual(1);
      expect(Math.abs(favicon - size * 0.4375)).toBeLessThanOrEqual(1);
    }
  });
});
