import { describe, expect, it, vi } from 'vitest';
import { newtabZenMode } from '../../../src/domain/settings/newtab-page';
import { createBrowserFake } from '../../fakes/browser';
import { parsePageCss, readRepoFile } from '../../fakes/css';
import { getElements } from '../../fakes/dom';
import { bootReadyNewtab } from './boot';
import { openSearchPage, pause, type SearchPage } from './search-page';

// /zen hides everything on New Tab but the search box, without changing what
// each section is set to show, and is remembered for the next New Tab.
const ZEN = newtabZenMode.key;

function sections() {
  return getElements(document, '[data-content-visible]').map((section) => ({
    configured: section.getAttribute('data-content-visible'),
    visible: section.getAttribute('data-visible')
  }));
}

type Activate = (search: SearchPage, row: HTMLElement) => Promise<unknown>;

describe('/zen on New Tab', () => {
  it.each<[string, Activate]>([
    ['Enter', (search) => search.press('Enter')],
    ['a click', (search, row) => search.click(row)]
  ])('turns Zen on and off with %s, keeping each section’s setting', async (_how, activate) => {
    const browser = createBrowserFake();
    const set = vi.spyOn(browser.storage.sync, 'set');
    const search = await openSearchPage(browser);
    const before = sections();
    expect(before.some((section) => section.visible === 'true')).toBe(true);

    await search.type('/zen');
    await search.waitForRows();
    expect(search.rows()[0].textContent).toContain('enter Zen mode');
    await activate(search, search.rows()[0]);
    await pause(100);
    expect(document.body.getAttribute('data-zen-mode')).toBe('true');
    expect(sections()).toEqual(before.map((section) => ({ configured: section.configured, visible: 'false' })));
    expect(set.mock.calls.some((call) => call[0][ZEN] === true)).toBe(true);

    await search.type('/zen');
    await search.waitForRows((rows) => (rows[0]?.textContent || '').includes('exit Zen mode'), '/zen should offer to turn Zen off');
    await search.press('Enter');
    await pause(100);
    expect(document.body.getAttribute('data-zen-mode')).toBe('false');
    expect(sections()).toEqual(before);
  });

  it('applies a remembered Zen mode before New Tab first shows', async () => {
    const zenWhenReady: Array<string | null> = [];
    const observer = new MutationObserver(() => {
      if (!zenWhenReady.length && document.body.getAttribute('data-nt-ready') === '1') {
        zenWhenReady.push(document.body.getAttribute('data-zen-mode'));
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-nt-ready'] });
    await bootReadyNewtab(createBrowserFake({ sync: { [ZEN]: true } }));
    observer.disconnect();

    expect(zenWhenReady).toEqual(['true']);
  });

  it('hides the corner controls in Zen mode', () => {
    const css = parsePageCss('newtab.html');
    ['.x-nt-wallpaper-control', '.x-nt-feedback-control'].forEach((control) => {
      expect(css.entries.some((entry) => entry.selectors.includes(`body[data-zen-mode="true"] ${control}`))).toBe(true);
    });
  });

  it.each(['en', 'zh_CN', 'zh_TW', 'ja'])('names the Zen command in %s', (locale) => {
    const messages: Record<string, { message?: string } | undefined> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    ['zen_badge_on', 'zen_badge_off', 'zen_enable_title', 'zen_disable_title'].forEach((key) => {
      expect(messages[key]?.message).toBeTruthy();
    });
  });
});
