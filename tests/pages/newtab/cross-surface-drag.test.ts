import { describe, expect, it, vi } from 'vitest';
import { parsePageCss, readRepoFile } from '../../fakes/css';
import { expectElement } from '../../fakes/dom';
import { openDragPage, type Point } from './drag-page';

// What a drag across New Tab's surfaces shows: a bookmark over the shortcuts
// leans the tiles beside the gap apart, a folder shortcut lights up instead,
// and Escape cancels; Escape during a shortcut reorder puts the tiles back.
// Where drops land and their undo are in shortcut-bookmark-drops.test.ts and
// bookmark-shortcut-transfer.test.ts.

const escape = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('dragging a bookmark over the shortcuts', () => {
  it('leans the tiles apart, lights up a folder shortcut, and Escape ends the drag moving nothing', async () => {
    const newtab = await openDragPage({
      shortcuts: [
        { url: 'https://one.example/', title: 'One' },
        { url: 'https://two.example/', title: 'Two' },
        { type: 'folder', folderId: 'design', title: 'Design' }
      ],
      bookmarks: [{ id: 'design', title: 'Design', children: [] }, { id: '20', title: 'Start', url: 'https://start.example/' }]
    });
    const grid = expectElement(newtab.tile('One').parentElement, 'the shortcut grid');
    const line = () => [grid.getAttribute('data-insert-line-position'), grid.getAttribute('data-insert-line-motion'),
      grid.style.getPropertyValue('--x-nt-insert-line-left'), grid.style.getPropertyValue('--x-nt-insert-line-height')];
    const gaps = () => ['One', 'Two', 'Design'].map((title) => newtab.tile(title).getAttribute('data-drag-gap'));
    const move = async (point: Point) => {
      newtab.pointer('pointermove', point[0], point[1]);
      await newtab.advance(40);
    };

    await newtab.drag(newtab.card('20'), [newtab.shortcutSlot(1)], { release: false });
    expect(document.body.getAttribute('data-drag-source')).toBe('bookmark');
    expect(line()).toEqual([null, null, '', '']);
    expect(gaps()).toEqual(['before', 'after', null]);

    await move(newtab.shortcutSlot(2));
    expect(gaps()).toEqual(['rest', 'before', 'after']);

    await move(newtab.layout.center(newtab.tile('Design')));
    expect(newtab.tile('Design').getAttribute('data-bookmark-drop-target')).toBe('true');
    expect(line()).toEqual([null, null, '', '']);

    await move(newtab.shortcutSlot(1));
    expect(newtab.tile('Design').getAttribute('data-bookmark-drop-target')).toBeNull();

    escape();
    await newtab.advance(200);
    expect(line()).toEqual([null, null, '', '']);
    expect(document.body.getAttribute('data-drag-source')).toBeNull();
    expect([newtab.shortcuts(), newtab.bar()]).toEqual([['One', 'Two', 'Design'], ['Design', 'Start']]);
  });
});

describe('Escape during a shortcut reorder', () => {
  it('puts the tiles back without saving, and the release after it changes nothing', async () => {
    const newtab = await openDragPage({
      shortcuts: [
        { url: 'https://one.example/', title: 'One' },
        { url: 'https://two.example/', title: 'Two' },
        { url: 'https://three.example/', title: 'Three' }
      ]
    });
    const saves = vi.spyOn(newtab.browser.storage.sync, 'set');
    await newtab.drag(newtab.tile('One'), [[newtab.shortcutSlot(3)[0], 432]], { release: false });
    expect(newtab.shortcuts()).toEqual(['Two', 'Three', 'One']);
    expect(document.body.getAttribute('data-drag-source')).toBe('shortcut');

    escape();
    await newtab.advance(200);
    expect(newtab.shortcuts()).toEqual(['One', 'Two', 'Three']);
    expect(saves).not.toHaveBeenCalled();

    newtab.pointer('pointerup', 10, 10);
    await newtab.advance(100);
    expect(newtab.shortcuts()).toEqual(['One', 'Two', 'Three']);
  });
});

describe('the cross-surface drag look and copy', () => {
  const css = parsePageCss('newtab.html');

  it('draws one attribute-driven insertion line, positioned by each grid', () => {
    const line = css.entries.find((entry) => entry.selectors.includes('[data-insert-line-position]::after'));
    expect(line && line.style.getPropertyValue('position')).toBe('absolute');
    expect(line && line.style.getPropertyValue('left')).toMatch(/^calc\(var\(--x-nt-insert-line-left/);
    expect(css.rule('.x-nt-shortcuts-grid')?.get('position')).toBe('relative');
  });

  it('paints a dragged shortcut above the dock and bookmarks bar without blocking hit tests', () => {
    const dragging = css.rule('body[data-drag-source="shortcut"] .x-nt-shortcuts-section');
    expect(dragging && [dragging.get('z-index'), dragging.get('pointer-events')]).toEqual(['10001', 'none']);
  });

  it('has the transfer messages in every language checked', () => {
    ['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
      const messages: Record<string, { message?: string }> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
      ['newtab_shortcuts_moved_to_bookmarks', 'newtab_shortcuts_move_to_bookmarks_failed', 'bookmarks_moved_to_shortcuts']
        .forEach((key) => expect(messages[key]?.message, `${locale} ${key}`).toBeTruthy());
    });
  });
});
