const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readStylesheet } = require('../helpers/css-tokens');
const { runModuleInContext } = require('../helpers/module-script');
const { parseCss, parsePageCss } = require('../helpers/css-rules');
const { SURFACES, openSearchSurface } = require('../helpers/search-surfaces');

// Typing "/" in either search surface lists its commands, filtered as the
// user types, as command rows only; anything else is ordinary search.

const repoRoot = path.resolve(__dirname, '..', '..');
const localeNames = ['en', 'ja', 'zh_CN', 'zh_TW'];
const COMMANDS = {
  newtab: ['commandNewTab', 'commandSettings', 'modeSwitch', 'zenSwitch'],
  overlay: ['commandNewTab', 'commandSettings', 'modeSwitch', 'commandOpenTabs', 'commandCopyUrl', 'commandDocumentPip']
};

// The overlay offers web clipping only where the browser supports document
// picture-in-picture and the setting is on.
function open(name, webClip) {
  return openSearchSurface(name, name === 'overlay'
    ? {
      openContext: { documentPipEnabled: webClip !== false },
      settings: { _x_extension_document_pip_enabled_2026_unique_: webClip !== false },
      setup(window) {
        window.documentPictureInPicture = {};
      }
    }
    : {});
}

async function rows(surface, query) {
  await surface.type(query);
  await surface.settle(80);
  return surface.suggestions().map((row) => {
    const suggestion = row._xSuggestion || {};
    assert.strictEqual(row.getAttribute('data-command-row') === 'true', /^(command|modeSwitch|zenSwitch|webAppearanceSwitch)/.test(suggestion.type),
      `${surface.name}: only command results should be laid out as command rows`);
    return suggestion.type;
  });
}

function emptyText(surface) {
  const empty = surface.root.querySelector(surface.name === 'overlay' ? '.x-ov-empty-state' : '.x-nt-empty-state');
  return empty ? empty.textContent.trim() : '';
}

async function testDiscovery(name) {
  const surface = await open(name);
  assert.deepStrictEqual(await rows(surface, '/'), COMMANDS[name], `${name}: a bare slash should list every command, and nothing else`);
  assert.deepStrictEqual(await rows(surface, '/m'), ['modeSwitch'], `${name}: the list should filter as the user types`);
  assert.deepStrictEqual(await rows(surface, '/set'), ['commandSettings'], `${name}: aliases should match too`);
  for (const input of ['/unknown', '/nothing', '/settings-extra', '/newtab-extra']) {
    assert.deepStrictEqual(await rows(surface, input), [], `${name}: ${input} should match no command`);
    assert.strictEqual(emptyText(surface), 'No matching commands', `${name}: and say so instead of offering a search`);
  }
  const before = surface.page.messages.length;
  surface.press('Enter');
  await surface.settle(100);
  assert.strictEqual(surface.navigation(), null, `${name}: Enter on an unmatched command should not search or navigate`);
  assert.ok(!surface.page.messages.slice(before).some((message) => /createTab|searchOrNavigate/.test(message.action)));

  await surface.type('/mode');
  await surface.settle(80);
  assert.match(surface.suggestions()[0].querySelector(`.x-${name === 'overlay' ? 'ov' : 'nt'}-suggestion-command`).textContent, /\/mode/,
    `${name}: an exact command keeps its command label`);
  assert.ok(surface.suggestions()[0].querySelector(`.x-${name === 'overlay' ? 'ov' : 'nt'}-suggestion-command-description`),
    `${name}: with its description below`);

  assert.ok((await rows(surface, 'example.com')).includes('directUrl'), `${name}: ordinary input should offer the typed address again`);
  surface.close();
}

async function testNewTabCommands() {
  const surface = await open('newtab');
  assert.deepStrictEqual(await rows(surface, '/z'), ['zenSwitch'], 'New Tab should include /zen');
  assert.deepStrictEqual(await rows(surface, '/c'), [], 'New Tab has no copy or clip command');
  surface.close();
}

async function testOverlayCommands() {
  const surface = await open('overlay');
  assert.deepStrictEqual(await rows(surface, '/c'), ['commandCopyUrl', 'commandDocumentPip'], 'copy and clip stay listed until the input tells them apart');
  assert.deepStrictEqual(await rows(surface, '/t'), ['commandOpenTabs']);
  for (const input of ['/continue', '/test', '/copycat', '/tabs-extra']) {
    assert.deepStrictEqual(await rows(surface, input), [], `${input} should match no command`);
  }

  await rows(surface, '/copy');
  surface.press('Enter');
  await surface.settle(100);
  assert.ok(surface.page.messages.some((message) => message.action === 'copyCurrentPageUrl'), '/copy should copy the page address');
  surface.close();

  const tabs = await open('overlay');
  await rows(tabs, '/tabs');
  tabs.press('Enter');
  await tabs.settle(100);
  assert.strictEqual(tabs.scopeLabel(), 'Search open tabs', '/tabs should switch to searching open tabs');
  tabs.close();

  const mode = await openSearchSurface('overlay', { settings: { _x_extension_theme_mode_2024_unique_: 'light' } });
  await rows(mode, '/mode');
  const root = mode.root.getElementById('_x_extension_overlay_2024_unique_');
  const theme = root.getAttribute('data-theme');
  mode.press('Enter');
  await mode.settle(100);
  assert.notStrictEqual(root.getAttribute('data-theme'), theme, '/mode should switch the theme');
  assert.ok(mode.page.root(), 'and keep the command bar open');
  assert.strictEqual(mode.root.activeElement, mode.input(), 'with focus in the input');
  mode.close();

  const noClip = await open('overlay', false);
  assert.deepStrictEqual(await rows(noClip, '/'), COMMANDS.overlay.filter((type) => type !== 'commandDocumentPip'),
    'with web clipping off, only /clip should be missing');
  noClip.close();

  // Opened prefilled with the page's own address, the overlay does not offer
  // that page back as a typed address.
  const url = 'https://page.example.test/';
  const current = await openSearchSurface('overlay', {
    url,
    openContext: { currentTabId: 1, currentTabUrl: url, prioritizeCurrentPageMatch: true, tabs: [{ id: 1, windowId: 1, title: 'Page', url }] }
  });
  assert.ok(!(await rows(current, 'page.example.test')).includes('directUrl'), 'the overlay should not offer the page it is open on');
  assert.ok((await rows(current, 'other.example.test')).includes('directUrl'), 'other addresses are still offered');
  current.close();
}

// In Firefox, /appearance cycles the website appearance setting (the color
// scheme pages see) through automatic, light and dark, and the badge shows
// the current one. Chromium has no such setting, so the command is absent
// there (the lists above).
async function testWebAppearanceCommand(name) {
  let mode = 'light';
  const surface = await openSearchSurface(name, {
    respond(message) {
      if (message.action === 'getWebAppearance') {
        return { supported: true, mode, controllable: true };
      }
      if (message.action === 'setWebAppearance') {
        mode = message.mode;
        return { ok: true, mode, controllable: true };
      }
      return undefined;
    }
  });
  await surface.settle(50);
  assert.ok((await rows(surface, '/')).includes('webAppearanceSwitch'), `${name}: Firefox lists /appearance`);
  assert.deepStrictEqual(await rows(surface, '/a'), ['webAppearanceSwitch'], `${name}: /a finds it`);
  const badge = () => surface.root.getElementById(name === 'overlay'
    ? '_x_extension_mode_badge_2024_unique_'
    : '_x_extension_newtab_mode_badge_2024_unique_');
  const title = () => surface.suggestions()[0].textContent;

  await rows(surface, '/appearance');
  assert.match(title(), /Website appearance: switch to Dark/, `${name}: the row names the next appearance`);
  assert.strictEqual(badge().getAttribute('data-visible'), 'true');
  assert.strictEqual(badge().textContent, 'Website appearance: Light', `${name}: the badge shows the current one`);

  surface.press('Enter');
  await surface.settle(100);
  const sent = surface.page.messages.filter((message) => message.action === 'setWebAppearance');
  assert.deepStrictEqual(sent.map((message) => message.mode), ['dark'], `${name}: Enter switches to the next appearance`);
  assert.strictEqual(badge().textContent, 'Website appearance: Dark');
  assert.match(title(), /Website appearance: switch to Automatic/, `${name}: and offers the one after it`);
  assert.ok(name !== 'overlay' || surface.page.root(), 'the command bar stays open');
  assert.strictEqual(surface.navigation(), null, `${name}: switching neither searches nor navigates`);

  surface.press('Enter');
  await surface.settle(100);
  assert.strictEqual(mode, 'auto', `${name}: and from dark back to automatic`);
  assert.strictEqual(badge().textContent, 'Website appearance: Automatic');
  surface.close();
}

// The old plain inputs for web clip ("clip", "webclip", "web clip") still
// match it; the overlay runs it for them when Enter has no row to act on.
function testLegacyClipAliases() {
  const context = vm.createContext({});
  const { createSlashCommands } = runModuleInContext('src/overlay/panel/slash-commands.ts', context);
  const commands = createSlashCommands({
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback) => fallback,
    documentPipEnabledAtOpen: true,
    elements: { searchInput: { value: '' } }
  });
  ['clip', 'webclip', 'web clip'].forEach((input) => {
    assert.deepStrictEqual(Array.from(commands.getCommandMatches(input), (command) => command.type), ['commandDocumentPip'], `"${input}" should find web clip`);
  });
}

function testStyles() {
  const newtab = parsePageCss('newtab.html');
  const overlay = parseCss(readStylesheet('src/overlay/suggestions-view.css'));
  [['x-nt', newtab], ['x-ov', overlay]].forEach(([prefix, css]) => {
    const find = (selector) => css.entries.filter((entry) => entry.selectors.some((item) => item.endsWith(selector)) && entry.conditions.length === 0)
      .reduce((merged, entry) => Object.assign(merged, Object.fromEntries(Array.from(entry.style).map((name) => [name, entry.style.getPropertyValue(name).replace(/\s+/g, ' ').trim()]))), {});
    const commandRow = find(`.${prefix}-suggestion-item[data-command-row="true"]`);
    assert.deepStrictEqual([commandRow.height, commandRow['min-height'], commandRow['padding-top'], commandRow['padding-bottom']],
      [`var(--${prefix}-suggestion-row-height, 52px)`, `var(--${prefix}-suggestion-row-height, 52px)`, '7px', '7px'],
      `${prefix} command rows should keep the 52px row height`);
    const command = find(`.${prefix}-suggestion-command`);
    const description = find(`.${prefix}-suggestion-command-description`);
    assert.deepStrictEqual([command['font-size'], command['line-height'], description['font-size'], description['line-height']], ['14px', '18px', '11px', '15px'],
      `${prefix} command and description should fit two lines in the row`);
  });
  const row = newtab.rule('.x-nt-suggestion-item');
  assert.deepStrictEqual([row.get('height'), row.get('min-height')], ['var(--x-nt-suggestion-row-height, 52px)', 'var(--x-nt-suggestion-row-height, 52px)']);
  const empty = newtab.rule('.x-nt-empty-state');
  assert.deepStrictEqual(['height', 'min-height', 'display', 'flex-direction', 'align-items', 'justify-content'].map((name) => empty.get(name)),
    [null, 'var(--x-nt-suggestion-row-height, 52px)', 'flex', 'column', 'center', 'center'],
    'the empty state should stack its art over the words, centered, at least one row tall');
}

function testCopy() {
  localeNames.forEach((localeName) => {
    const messages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales', localeName, 'messages.json'), 'utf8'));
    ['slash_command_empty', 'command_tabs_title', 'command_tabs_action', 'command_copy_title', 'command_copy_action',
      'web_appearance_switch_title', 'web_appearance_badge', 'web_appearance_label_auto'].forEach((key) => {
      assert.ok(messages[key] && messages[key].message, `${localeName} should localize ${key}`);
    });
  });
}

(async () => {
  for (const name of SURFACES) {
    await testDiscovery(name);
  }
  await testNewTabCommands();
  await testOverlayCommands();
  for (const name of SURFACES) {
    await testWebAppearanceCommand(name);
  }
  testLegacyClipAliases();
  testStyles();
  testCopy();
  console.log('slash command discovery tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
