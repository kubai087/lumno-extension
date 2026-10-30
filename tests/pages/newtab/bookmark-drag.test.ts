import { describe, expect, it } from 'vitest';
import { parsePageCss, readRepoFile } from '../../fakes/css';
import { openDragPage } from './drag-page';

// Dragging bookmarks on New Tab: into a folder or to another place in the
// grid moves the bookmark, marks the source and the target while it
// happens, and can be undone; a press without a drag stays a click. And the
// drag's look, as the stylesheets ship it.

const BOOKMARKS = [
  { id: 'link', title: 'Link', url: 'https://link.example/' },
  { id: 'archive', title: 'Archive', children: [] },
  { id: 'other', title: 'Other', url: 'https://other.example/' },
  { id: 'last', title: 'Last', url: 'https://last.example/' }
];

describe('dragging a bookmark', () => {
  it('marks the dragged card and the folder under the pointer, and moves the bookmark into it', async () => {
    const newtab = await openDragPage({ bookmarks: BOOKMARKS });
    const archive = newtab.layout.center(newtab.card('archive'));
    await newtab.drag(newtab.card('link'), [archive], { release: false });
    expect(document.body.getAttribute('data-drag-source')).toBe('bookmark');
    expect(newtab.card('link').getAttribute('data-bookmark-dragging')).toBe('true');
    expect(document.querySelector('.x-nt-bookmark-card-drag-preview')).not.toBeNull();
    expect(newtab.card('archive').getAttribute('data-bookmark-drop-target')).toBe('true');

    newtab.pointer('pointerup', archive[0], archive[1]);
    await newtab.advance(300);
    expect(newtab.bar()).toEqual(['Archive', 'Other', 'Last']);
    expect(newtab.bookmarks.titles('archive')).toEqual(['Link']);
    expect(document.body.getAttribute('data-drag-source')).toBeNull();
    expect(document.querySelector('.x-nt-bookmark-card-drag-preview')).toBeNull();

    await newtab.undo();
    expect(newtab.bar()).toEqual(['Link', 'Archive', 'Other', 'Last']);
  });

  it('moves a bookmark dropped at the end of the row last, and undo and redo replay it', async () => {
    const newtab = await openDragPage({ bookmarks: BOOKMARKS });
    await newtab.dragTo(newtab.card('link'), newtab.bookmarkSlot(4));
    expect(newtab.bar()).toEqual(['Archive', 'Other', 'Last', 'Link']);
    await newtab.undo();
    expect(newtab.bar()).toEqual(['Link', 'Archive', 'Other', 'Last']);
    await newtab.redo();
    expect(newtab.bar()).toEqual(['Archive', 'Other', 'Last', 'Link']);
  });

  it('opens the bookmark on a press without a drag', async () => {
    const newtab = await openDragPage({ bookmarks: BOOKMARKS });
    const card = newtab.card('other');
    const box = card.getBoundingClientRect();
    newtab.pointer('pointerdown', box.left + 10, box.top + 10, card);
    newtab.pointer('pointerup', box.left + 10, box.top + 10, card);
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: box.left + 10, clientY: box.top + 10 }));
    await newtab.advance(150);
    const opened = [
      ...newtab.browser.tabs.create.mock.calls.map((call) => call[0]),
      ...newtab.browser.tabs.update.mock.calls.map((call) => call[1]),
      ...newtab.browser.runtime.sendMessage.mock.calls.map((call) => call[0])
    ];
    expect(JSON.stringify(opened)).toContain('https://other.example/');
    expect(newtab.bar()).toEqual(['Link', 'Archive', 'Other', 'Last']);
  });
});

describe('the bookmark drag look', () => {
  const css = parsePageCss('newtab.html');
  const selectors = css.selectors();

  it('marks drop targets, the drag page target, the hover and the refreshing menu', () => {
    [
      '.x-nt-bookmarks-crumb[data-bookmark-drop-target="true"]',
      '.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]',
      '.x-nt-bookmark-cascade-item--folder[data-bookmark-drop-target="true"]',
      '[data-bookmark-drag-page-target="true"]',
      '.x-nt-bookmark-card.x-nt-bookmark-card--hover:not([aria-expanded="true"])',
      '.x-nt-bookmark-cascade-menu[data-refreshing="true"] .x-nt-bookmark-cascade-level'
    ].forEach((selector) => expect(selectors.some((item) => item.includes(selector)), selector).toBe(true));
    expect(selectors.some((item) => item.startsWith('.x-nt-bookmark-cascade-menu[data-drag-mode="true"] .x-nt-bookmark-cascade-level'))).toBe(true);
  });

  it('marks the insertion side of menu rows, while grid cards share one insertion line', () => {
    expect(selectors.some((item) => item.includes('[data-bookmark-insert-position="before"]'))).toBe(true);
    expect(selectors.some((item) => item.includes('[data-bookmark-insert-position="after"]'))).toBe(true);
    expect(selectors.some((item) => item.includes('.x-nt-bookmark-card[data-bookmark-insert-position]::after'))).toBe(false);
  });

  it('gives folder targets a crisp edge, and bar folders a visible background', () => {
    const folderTarget = css.rule('.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]');
    expect(folderTarget && folderTarget.has('border-color')).toBe(true);
    expect(folderTarget && folderTarget.get('box-shadow')).toBe('none');
    const topbarTarget = css.entries.find((entry) => entry.selectors.some((item) => item.startsWith('.x-nt-bookmarks-topbar') &&
      item.endsWith('.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]')));
    expect(topbarTarget && topbarTarget.style.getPropertyValue('background').trim()).toBe('var(--x-nt-bookmarks-topbar-folder-hover)');
  });

  it('extends the insertion line, in a neutral gray in both themes', () => {
    ['a', 'b'].forEach((variant) => {
      const frames = css.keyframes(`_x_nt_insert_line_extend_${variant}_2026_unique_`);
      expect(frames && [frames['0%'].getPropertyValue('transform'), frames['100%'].getPropertyValue('transform')]).toEqual(['scaleY(0)', 'scaleY(1)']);
    });
    const indicators = css.entries.map((entry) => entry.style.getPropertyValue('--x-nt-insert-indicator').trim()).filter(Boolean);
    expect(indicators).toEqual(expect.arrayContaining(['#7a8491', '#a8b0bc']));
    expect(css.entries.some((entry) => entry.selectors.some((item) => item.includes('data-bookmark-insert-position')) &&
      /#2563eb/i.test(entry.style.getPropertyValue('background')))).toBe(false);
  });

  it('floats a menu row preview in its own layer and leaves translucent placeholders', () => {
    expect(css.rule('.x-nt-bookmark-cascade-drag-preview')?.get('z-index')).toBe('2147483645');
    expect(css.rule('.x-nt-bookmark-card[data-bookmark-dragging="true"]:not(.x-nt-bookmark-card-drag-preview)')?.get('opacity')).toBe('0.36');
    expect(css.rule('.x-nt-bookmark-cascade-item[data-bookmark-dragging="true"]:not(.x-nt-bookmark-cascade-drag-preview)')?.get('opacity')).toBe('0.38');
  });

  it('hides the copy button of a dragged menu row', () => {
    const copyTrigger = css.entries.find((entry) => entry.selectors.some((item) =>
      item.includes('.x-nt-bookmark-cascade-row:has(> .x-nt-bookmark-cascade-item[data-bookmark-dragging="true"])') &&
      item.endsWith('> .x-nt-bookmark-cascade-copy-trigger')));
    expect(copyTrigger && [copyTrigger.style.getPropertyValue('opacity'), copyTrigger.style.getPropertyValue('pointer-events')]).toEqual(['0', 'none']);
  });

  it('has the move messages in every language checked', () => {
    ['en', 'zh_CN', 'zh_TW', 'ja'].forEach((locale) => {
      const messages: Record<string, { message?: string }> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
      ['bookmarks_move_success', 'bookmarks_move_undone', 'bookmarks_move_redone', 'bookmarks_move_failed']
        .forEach((key) => expect(messages[key]?.message, `${locale} ${key}`).toBeTruthy());
    });
  });
});
