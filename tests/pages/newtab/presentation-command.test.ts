import { describe, expect, it, vi } from 'vitest';
import { newtabPresentationMode } from '../../../src/domain/settings/newtab-page';
import { recentCount, recentMode } from '../../../src/domain/settings/recent-sites';
import { createBrowserFake } from '../../fakes/browser';
import { readRepoFile } from '../../fakes/css';
import { getElements } from '../../fakes/dom';
import { openSearchPage, pause } from './search-page';

// /present keeps what is personal off a shared screen: recent sites and
// bookmarks hide, shortcuts stay, and it is separate from Zen.
const PRESENTATION = newtabPresentationMode.key;
const RECENT_SECTION_ID = '_x_extension_newtab_recent_sites_2024_unique_';
const NOW = Date.now();

function sections() {
  return getElements(document, '[data-content-visible]').map((section) => ({
    id: section.id,
    shortcuts: section.classList.contains('x-nt-shortcuts-section'),
    configured: section.getAttribute('data-content-visible'),
    visible: section.getAttribute('data-visible')
  }));
}

describe('/present on New Tab', () => {
  it('hides recent sites and bookmarks but not shortcuts, and turns off again', async () => {
    const browser = createBrowserFake({
      sync: { [recentCount.key]: 8, [recentMode.key]: 'latest' },
      history: [
        { url: 'https://private.example.com/', title: 'Private', lastVisitTime: NOW - 1000, visitCount: 3 },
        { url: 'https://notes.example.com/', title: 'Notes', lastVisitTime: NOW - 2000, visitCount: 2 }
      ]
    });
    const set = vi.spyOn(browser.storage.sync, 'set');
    const search = await openSearchPage(browser);
    await vi.waitFor(() => expect(sections().find((section) => section.id === RECENT_SECTION_ID)?.visible).toBe('true'));
    const before = sections();

    await search.type('/present');
    await search.waitForRows();
    expect(search.rows()[0].textContent).toContain('/present');
    expect(search.rows()[0].textContent).toContain('enter presentation mode, hiding recent sites, bookmarks, and frequent, bookmark and history results');
    await search.press('Enter');
    await pause(100);
    expect(sections()).toEqual(before.map((section) => ({
      ...section,
      visible: section.shortcuts ? section.visible : 'false'
    })));
    expect(document.body.getAttribute('data-zen-mode')).toBe('false');
    expect(set.mock.calls.some((call) => call[0][PRESENTATION] === true)).toBe(true);

    await search.type('/present');
    await search.waitForRows((rows) => (rows[0]?.textContent || '').includes('exit presentation mode'), '/present should offer to turn it off');
    await search.press('Enter');
    await pause(100);
    expect(sections()).toEqual(before);
  });

  it.each(['en', 'zh_CN', 'zh_TW', 'ja', 'ko', 'de', 'fr', 'es', 'pt_BR', 'ru'])('names the presentation command in %s', (locale) => {
    const messages: Record<string, { message?: string } | undefined> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    ['presentation_badge_on', 'presentation_badge_off', 'presentation_enable_title', 'presentation_disable_title'].forEach((key) => {
      expect(messages[key]?.message).toBeTruthy();
    });
  });
});
