import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootOverlayPage, settle, suggestionOf, OVERLAY_ID, type OverlayPage, type OverlayPageOptions } from './boot';
import { getElement, required } from '../../fakes/dom';

// Typing "/" in the overlay lists its commands, filtered as the user types,
// as command rows only; anything else is ordinary search. New Tab's side is
// in tests/pages/newtab/slash-commands.test.ts.
const COMMAND_TYPE = /^(command|modeSwitch|zenSwitch|webAppearanceSwitch)/;
const DOCUMENT_PIP_KEY = '_x_extension_document_pip_enabled_2026_unique_';
const THEME_KEY = '_x_extension_theme_mode_2024_unique_';
const COMMANDS = ['commandNewTab', 'commandSettings', 'modeSwitch', 'commandOpenTabs', 'commandCopyUrl', 'commandDocumentPip'];

const opened: OverlayPage[] = [];

// The overlay's closing messages are answered while the page still runs.
afterEach(async () => {
  for (const page of opened.splice(0)) {
    if (page.host()) {
      page.toggle();
      await settle(2000);
    }
  }
});

// The overlay offers web clipping only where the browser supports document
// picture-in-picture and the setting is on.
async function openOverlay(webClip = true, options: OverlayPageOptions = {}, context: Record<string, unknown> = {}) {
  const page = await bootOverlayPage({ ...options, settings: { [DOCUMENT_PIP_KEY]: webClip, ...options.settings } });
  vi.stubGlobal('documentPictureInPicture', {});
  opened.push(page);
  const root = await page.open({ documentPipEnabled: webClip, ...context });
  return { page, root };
}

async function rowsFor(page: OverlayPage, query: string): Promise<unknown[]> {
  await page.type(query);
  await settle(80);
  return page.suggestions().map((row) => {
    const type = suggestionOf(row).type;
    expect(row.getAttribute('data-command-row') === 'true').toBe(COMMAND_TYPE.test(String(type)));
    return type;
  });
}

const actions = (page: OverlayPage) => page.messages.map((message) => message.action);

describe('Overlay slash commands', () => {
  it('lists every command for a bare slash and filters as the user types', async () => {
    const { page } = await openOverlay();

    expect(await rowsFor(page, '/')).toEqual(COMMANDS);
    expect(await rowsFor(page, '/m')).toEqual(['modeSwitch']);
    expect(await rowsFor(page, '/set')).toEqual(['commandSettings']);
    expect(await rowsFor(page, '/c')).toEqual(['commandCopyUrl', 'commandDocumentPip']);
    expect(await rowsFor(page, '/t')).toEqual(['commandOpenTabs']);
    for (const input of ['/continue', '/test', '/copycat', '/tabs-extra']) {
      expect(await rowsFor(page, input)).toEqual([]);
    }
  });

  it('says no command matches, and Enter then neither searches nor navigates', async () => {
    const { page, root } = await openOverlay();
    for (const input of ['/unknown', '/nothing', '/settings-extra', '/newtab-extra']) {
      expect(await rowsFor(page, input)).toEqual([]);
      expect((getElement(root, '.x-ov-empty-state').textContent || '').trim()).toBe('No matching commands');
    }
    const before = page.messages.length;

    page.press('Enter');
    await settle(100);
    expect(page.messages.slice(before).map((message) => message.action).filter((action) => /createTab|searchOrNavigate/.test(action))).toEqual([]);
  });

  it('keeps the command label and its description on an exact command', async () => {
    const { page } = await openOverlay();
    await rowsFor(page, '/mode');
    const [row] = page.suggestions();

    expect(getElement(row, '.x-ov-suggestion-command').textContent).toMatch(/\/mode/);
    expect(row.querySelector('.x-ov-suggestion-command-description')).not.toBeNull();
  });

  it('offers the typed address again for ordinary input', async () => {
    const { page } = await openOverlay();

    expect(await rowsFor(page, 'example.com')).toContain('directUrl');
  });

  it('copies the page address with /copy', async () => {
    const { page } = await openOverlay();
    await rowsFor(page, '/copy');

    page.press('Enter');
    await settle(100);
    expect(actions(page)).toContain('copyCurrentPageUrl');
  });

  it('switches to searching open tabs with /tabs', async () => {
    const { page, root } = await openOverlay();
    await rowsFor(page, '/tabs');

    page.press('Enter');
    await settle(100);
    const label = getElement(root, '[data-search-input-mode-prefix] [data-search-input-mode-prefix-text]');
    expect((label.textContent || '').trim()).toBe('Search open tabs');
  });

  it('switches the theme with /mode and stays open with focus in the input', async () => {
    const { page, root } = await openOverlay(true, { settings: { [THEME_KEY]: 'light' } });
    await rowsFor(page, '/mode');
    const overlay = required(root.getElementById(OVERLAY_ID), 'the overlay');
    const theme = overlay.getAttribute('data-theme');

    page.press('Enter');
    await settle(100);
    expect(overlay.getAttribute('data-theme')).not.toBe(theme);
    expect(page.root()).not.toBeNull();
    expect(root.activeElement).toBe(page.input());
  });

  it('leaves out only /clip while web clipping is off', async () => {
    const { page } = await openOverlay(false);

    expect(await rowsFor(page, '/')).toEqual(COMMANDS.filter((type) => type !== 'commandDocumentPip'));
  });

  it('does not offer back the address of the page it is open on', async () => {
    const url = 'https://page.example.test/';
    const { page } = await openOverlay(true, {}, {
      currentTabUrl: url,
      prioritizeCurrentPageMatch: true,
      tabs: [{ id: 1, windowId: 1, title: 'Page', url }]
    });

    expect(await rowsFor(page, 'page.example.test')).not.toContain('directUrl');
    expect(await rowsFor(page, 'other.example.test')).toContain('directUrl');
  });

  it('cycles the website appearance with /appearance where the browser has one', async () => {
    let mode = 'light';
    const { page, root } = await openOverlay(true, {
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
    await settle(50);
    const badge = () => required(root.getElementById('_x_extension_mode_badge_2024_unique_'), 'the mode badge');
    const title = () => page.suggestions()[0].textContent;

    expect(await rowsFor(page, '/')).toContain('webAppearanceSwitch');
    expect(await rowsFor(page, '/a')).toEqual(['webAppearanceSwitch']);
    await rowsFor(page, '/appearance');
    expect(title()).toMatch(/Website appearance: switch to Dark/);
    expect(badge().getAttribute('data-visible')).toBe('true');
    expect(badge().textContent).toBe('Website appearance: Light');

    page.press('Enter');
    await settle(100);
    expect(page.messages.filter((message) => message.action === 'setWebAppearance').map((message) => message.mode)).toEqual(['dark']);
    expect(badge().textContent).toBe('Website appearance: Dark');
    expect(title()).toMatch(/Website appearance: switch to Automatic/);
    expect(page.root()).not.toBeNull();
    expect(actions(page).filter((action) => /createTab|searchOrNavigate/.test(action))).toEqual([]);

    page.press('Enter');
    await settle(100);
    expect(mode).toBe('auto');
    expect(badge().textContent).toBe('Website appearance: Automatic');
  });
});
