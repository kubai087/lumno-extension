import { describe, expect, it } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';
import { parseCss, parsePageCss, readRepoFile, readStylesheet, type ParsedCss } from '../../fakes/css';
import { getElement, getElementById } from '../../fakes/dom';
import { openSearchPage, pause, suggestionOf, type SearchPage } from './search-page';

// Typing "/" in the New Tab search box lists its commands, filtered as the
// user types, as command rows only; anything else is ordinary search. The
// overlay's side is in tests/pages/overlay/slash-commands.test.ts.
const COMMAND_TYPE = /^(command|modeSwitch|zenSwitch|webAppearanceSwitch)/;
const MODE_BADGE_ID = '_x_extension_newtab_mode_badge_2024_unique_';

// The row types for a query; only command results are laid out as command rows.
async function rowsFor(search: SearchPage, query: string): Promise<unknown[]> {
  await search.type(query);
  await pause(80);
  return search.rows().map((row) => {
    const type = suggestionOf(row).type;
    expect(row.getAttribute('data-command-row') === 'true').toBe(COMMAND_TYPE.test(String(type)));
    return type;
  });
}

function emptyText(): string {
  const empty = document.querySelector('.x-nt-empty-state');
  return empty ? (empty.textContent || '').trim() : '';
}

describe('New Tab slash commands', () => {
  it('lists every command for a bare slash and filters as the user types', async () => {
    const search = await openSearchPage(createBrowserFake());

    expect(await rowsFor(search, '/')).toEqual(['commandNewTab', 'commandSettings', 'modeSwitch', 'zenSwitch']);
    expect(await rowsFor(search, '/m')).toEqual(['modeSwitch']);
    expect(await rowsFor(search, '/set')).toEqual(['commandSettings']);
    expect(await rowsFor(search, '/z')).toEqual(['zenSwitch']);
    expect(await rowsFor(search, '/c')).toEqual([]);
  });

  it('says no command matches, and Enter then neither searches nor navigates', async () => {
    const browser = createBrowserFake();
    const search = await openSearchPage(browser);
    for (const input of ['/unknown', '/nothing', '/settings-extra', '/newtab-extra']) {
      expect(await rowsFor(search, input)).toEqual([]);
      expect(emptyText()).toBe('No matching commands');
    }
    browser.runtime.sendMessage.mockClear();

    await search.press('Enter');
    await pause(100);
    expect(browser.search.query).not.toHaveBeenCalled();
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(browser.tabs.update).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage.mock.calls.map((call) => JSON.stringify(call[0]))
      .filter((sent) => /createTab|searchOrNavigate/.test(sent))).toEqual([]);
  });

  it('keeps the command label and its description on an exact command', async () => {
    const search = await openSearchPage(createBrowserFake());
    await rowsFor(search, '/mode');
    const [row] = search.rows();

    expect(getElement(row, '.x-nt-suggestion-command').textContent).toMatch(/\/mode/);
    expect(row.querySelector('.x-nt-suggestion-command-description')).not.toBeNull();
  });

  it('offers the typed address again for ordinary input', async () => {
    const search = await openSearchPage(createBrowserFake());

    expect(await rowsFor(search, 'example.com')).toContain('directUrl');
  });

  it('cycles the website appearance with /appearance where the browser has one', async () => {
    let mode = 'light';
    const browser = createBrowserFake({
      respond(message) {
        if (message.action === 'getWebAppearance') {
          return { supported: true, mode, controllable: true };
        }
        if (message.action === 'setWebAppearance') {
          mode = String(message.mode);
          return { ok: true, mode, controllable: true };
        }
        return undefined;
      }
    });
    const search = await openSearchPage(browser);
    await pause(50);
    const badge = () => getElementById(MODE_BADGE_ID);
    const title = () => search.rows()[0].textContent;

    expect(await rowsFor(search, '/')).toContain('webAppearanceSwitch');
    expect(await rowsFor(search, '/a')).toEqual(['webAppearanceSwitch']);
    await rowsFor(search, '/appearance');
    expect(title()).toMatch(/Website appearance: switch to Dark/);
    expect(badge().getAttribute('data-visible')).toBe('true');
    expect(badge().textContent).toBe('Website appearance: Light');

    browser.runtime.sendMessage.mockClear();
    await search.press('Enter');
    await pause(100);
    const sentModes = () => browser.runtime.sendMessage.mock.calls.map((call) => requestedAppearance(call[0]));
    expect(sentModes().filter(Boolean)).toEqual(['dark']);
    expect(badge().textContent).toBe('Website appearance: Dark');
    expect(title()).toMatch(/Website appearance: switch to Automatic/);
    expect(browser.search.query).not.toHaveBeenCalled();
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(browser.tabs.update).not.toHaveBeenCalled();

    await search.press('Enter');
    await pause(100);
    expect(mode).toBe('auto');
    expect(badge().textContent).toBe('Website appearance: Automatic');
  });
});

// The mode a setWebAppearance message asks for, or '' for other messages.
function requestedAppearance(message: unknown): string {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'setWebAppearance' &&
    'mode' in message ? String(message.mode) : '';
}

// Every unconditioned declaration for rows ending in `selector`, merged.
function declarations(css: ParsedCss, selector: string): Record<string, string> {
  return css.entries
    .filter((entry) => entry.selectors.some((item) => item.endsWith(selector)) && entry.conditions.length === 0)
    .reduce<Record<string, string>>((merged, entry) => Object.assign(merged, Object.fromEntries(
      entry.style.names.map((name) => [name, entry.style.getPropertyValue(name).replace(/\s+/g, ' ').trim()])
    )), {});
}

describe('Slash command styles and copy', () => {
  it.each<[string, ParsedCss]>([
    ['x-nt', parsePageCss('newtab.html')],
    ['x-ov', parseCss(readStylesheet('src/overlay/suggestions-view.css'))]
  ])('fits a %s command and its description in the 52px row', (prefix, css) => {
    const commandRow = declarations(css, `.${prefix}-suggestion-item[data-command-row="true"]`);
    expect([commandRow.height, commandRow['min-height'], commandRow['padding-top'], commandRow['padding-bottom']])
      .toEqual([`var(--${prefix}-suggestion-row-height, 52px)`, `var(--${prefix}-suggestion-row-height, 52px)`, '7px', '7px']);
    const command = declarations(css, `.${prefix}-suggestion-command`);
    const description = declarations(css, `.${prefix}-suggestion-command-description`);
    expect([command['font-size'], command['line-height'], description['font-size'], description['line-height']])
      .toEqual(['14px', '18px', '11px', '15px']);
  });

  it('keeps New Tab rows one row tall and stacks the empty state centered', () => {
    const css = parsePageCss('newtab.html');
    const row = css.rule('.x-nt-suggestion-item');
    expect([row?.get('height'), row?.get('min-height')]).toEqual(['var(--x-nt-suggestion-row-height, 52px)', 'var(--x-nt-suggestion-row-height, 52px)']);
    const empty = css.rule('.x-nt-empty-state');
    expect(['height', 'min-height', 'display', 'flex-direction', 'align-items', 'justify-content'].map((name) => empty?.get(name)))
      .toEqual([null, 'var(--x-nt-suggestion-row-height, 52px)', 'flex', 'column', 'center', 'center']);
  });

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('localizes the command copy in %s', (locale) => {
    const messages: Record<string, { message?: string } | undefined> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    ['slash_command_empty', 'command_tabs_title', 'command_tabs_action', 'command_copy_title', 'command_copy_action',
      'web_appearance_switch_title', 'web_appearance_badge', 'web_appearance_label_auto'].forEach((key) => {
      expect(messages[key]?.message).toBeTruthy();
    });
  });
});
