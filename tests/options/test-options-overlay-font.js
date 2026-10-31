const assert = require('assert');
const settings = require('../../src/domain/settings/index.ts');
const { createOptionsPage } = require('../helpers/options-page');

// The overlay font rows in Settings: listing the installed fonts, saving a
// choice on this device, and flagging a chosen font the device does not have.

const FONT_SELECT = '_x_extension_overlay_font_select_2026_unique_';
const FALLBACK_SELECT = '_x_extension_overlay_font_fallback_select_2026_unique_';
const FAMILY_KEY = settings.overlayFontFamily.key;
const FALLBACK_KEY = settings.overlayFontFallback.key;
const LABELS_KEY = settings.overlayFontLabels.key;
const FONTS = [{ fontId: 'Inter', displayName: 'Inter' }, { fontId: 'PingFangSC', displayName: '苹方-简' }];

const fontWrites = (area) => area.writes.filter((write) => Object.keys(write).some((key) => key.includes('overlay_font')));

async function testRowsAndTheirMarkup() {
  const page = await createOptionsPage({ fonts: FONTS });
  const doc = page.document;
  const row = (id) => page.byId(`_x_extension_${id}_2026_unique_`);
  const follows = (later, earlier) => Boolean(earlier.compareDocumentPosition(later) & page.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(follows(row('overlay_font_row'), row('overlay_enter_animation_tabs_wrap')),
    'the font row should follow the opening animation row');
  assert.ok(follows(row('overlay_font_fallback_row'), row('overlay_font_row')));
  assert.ok(follows(row('overlay_page_theme_adaptation_row'), row('overlay_font_fallback_row')),
    'webpage theme adaptation should stay the last overlay appearance setting');
  [FONT_SELECT, FALLBACK_SELECT].forEach((id) => {
    assert.strictEqual(doc.querySelector(`[data-select="${id}"]`).getAttribute('data-select-searchable'), 'true',
      'installed font lists run to hundreds of entries, so the menu should be searchable');
  });
  assert.strictEqual(page.byId('_x_extension_overlay_font_row_2026_unique_').getAttribute('data-browser-unsupported'), 'firefox',
    'Firefox cannot list fonts and should show the row disabled with the reason');
  page.close();
}

async function testInstalledFontsAreListedAndChosenOnThisDevice() {
  const page = await createOptionsPage({ fonts: FONTS });
  // The font list and the menus' translated labels both arrive asynchronously.
  const listed = (selectId) => {
    const options = page.menuOptions(selectId);
    return options.length > 1 && options.every((option) => option.label);
  };
  await page.waitFor(() => listed(FONT_SELECT) && listed(FALLBACK_SELECT), 'the installed fonts should be listed');
  const installed = [{ value: 'Inter', label: 'Inter' }, { value: 'PingFangSC', label: '苹方-简' }]
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  assert.deepStrictEqual(page.menuOptions(FONT_SELECT), [
    { value: '', label: '默认' },
    ...installed
  ], 'the bundled default should come first, then the installed fonts by display name');
  assert.deepStrictEqual(page.menuOptions(FALLBACK_SELECT).map((option) => option.label), ['无', ...installed.map((option) => option.label)],
    'the fallback row should be optional and list the same fonts');

  const syncWritesBefore = fontWrites(page.storage.sync).length;
  await page.pick(FONT_SELECT, 'PingFangSC');
  assert.deepStrictEqual(fontWrites(page.storage.local).at(-1), { [FAMILY_KEY]: 'PingFangSC', [LABELS_KEY]: { PingFangSC: '苹方-简' } },
    'choosing a font should keep its family and display name on this device');
  await page.pick(FALLBACK_SELECT, 'Inter');
  assert.deepStrictEqual(fontWrites(page.storage.local).at(-1), {
    [FALLBACK_KEY]: 'Inter',
    [LABELS_KEY]: { PingFangSC: '苹方-简', Inter: 'Inter' }
  }, 'the stored names should cover just the two chosen families');
  assert.strictEqual(fontWrites(page.storage.sync).length, syncWritesBefore, 'installed fonts should never reach browser sync');

  page.changeStorage('local', FAMILY_KEY, 'Inter');
  await page.waitFor(() => page.document.getElementById(`${FONT_SELECT}_control_value`).textContent === 'Inter',
    'a font chosen on another Settings page should show here');
  page.close();
}

async function testAMissingFontIsNamedAndCanBeReset() {
  const page = await createOptionsPage({
    fonts: FONTS,
    local: { [FAMILY_KEY]: 'Missing Sans', [LABELS_KEY]: { 'Missing Sans': 'Missing Sans Display' } }
  });
  assert.ok(page.menuOptions(FONT_SELECT).some((option) => option.value === 'Missing Sans' && option.label === 'Missing Sans Display'),
    'a chosen family that is not installed should still show under its stored name');
  const notice = page.byId('_x_extension_overlay_font_missing_2026_unique_');
  assert.strictEqual(notice.hidden, false, 'the row should say the chosen font is missing');
  assert.match(notice.textContent, /Missing Sans Display/, 'the notice should name the font by its display name');
  assert.strictEqual(page.byId('_x_extension_overlay_font_fallback_missing_2026_unique_').hidden, true);

  await page.click(notice.querySelector('._x_extension_overlay_font_reset_2026_unique_'));
  assert.strictEqual(fontWrites(page.storage.local).at(-1)[FAMILY_KEY], '', 'one click should put the default back');
  assert.strictEqual(notice.hidden, true);
  page.close();

  const english = await createOptionsPage({
    fonts: FONTS,
    sync: { _x_extension_language_2024_unique_: 'en' },
    local: { [FAMILY_KEY]: 'Missing Sans' }
  });
  await english.settle(100);
  const englishNotice = english.byId('_x_extension_overlay_font_missing_2026_unique_');
  assert.match(englishNotice.textContent, /Missing Sans/);
  assert.doesNotMatch(englishNotice.textContent, /这台设备/, 'the notice should follow the page language');
  english.close();
}

async function testNoFontListMeansNothingIsMissing() {
  for (const fonts of [[], null]) {
    const page = await createOptionsPage({ fonts, local: { [FAMILY_KEY]: 'Inter' } });
    assert.strictEqual(page.byId('_x_extension_overlay_font_missing_2026_unique_').hidden, true,
      fonts === null ? 'a browser without the font list should not flag the font' : 'a failed or empty list should not flag every font as missing');
    assert.ok(page.menuOptions(FONT_SELECT).some((option) => option.value === ''), 'the default should still be offered');
    page.close();
  }
}

(async () => {
  await testRowsAndTheirMarkup();
  await testInstalledFontsAreListedAndChosenOnThisDevice();
  await testAMissingFontIsNamedAndCanBeReset();
  await testNoFontListMeansNothingIsMissing();
  console.log('options overlay font tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
