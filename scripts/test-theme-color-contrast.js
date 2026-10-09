const assert = require('assert');
const fs = require('fs');

const faviconTheme = require('../src/newtab/favicon-theme.js');
const { readPageSource } = require('./helpers/page-source');

function parseThemeColor(value) {
  const parsed = faviconTheme.parseCssColor(value);
  assert.ok(parsed, `expected a parseable theme color, received ${value}`);
  return parsed;
}

function assertContrast(foreground, background, minimum, message) {
  const ratio = faviconTheme.getContrastRatio(
    parseThemeColor(foreground),
    Array.isArray(background) ? background : parseThemeColor(background)
  );
  assert.ok(
    ratio >= minimum,
    `${message}: expected ${minimum}:1, received ${ratio.toFixed(3)}:1`
  );
}

function getContrast(foreground, background) {
  return faviconTheme.getContrastRatio(
    parseThemeColor(foreground),
    Array.isArray(background) ? background : parseThemeColor(background)
  );
}

function assertSoftBoundary(foreground, background, message) {
  const ratio = getContrast(foreground, background);
  assert.ok(
    ratio >= 1.4 && ratio <= 1.47,
    `${message}: expected a soft 1.4:1 boundary, received ${ratio.toFixed(3)}:1`
  );
}

function getHslSaturation(value) {
  const rgb = (Array.isArray(value) ? value : parseThemeColor(value)).map(
    (channel) => channel / 255
  );
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const lightness = (max + min) / 2;
  const delta = max - min;
  return delta ? delta / (1 - Math.abs((2 * lightness) - 1)) : 0;
}

const accentSamples = [
  [255, 193, 7],
  [255, 235, 59],
  [190, 255, 0],
  [0, 174, 236],
  [255, 0, 0],
  [36, 41, 46],
  [248, 250, 252]
];

accentSamples.forEach((accent) => {
  const lightTheme = faviconTheme.buildTheme(accent);
  const variants = [
    {
      mode: 'light',
      theme: lightTheme,
      base: [255, 255, 255],
      hover: faviconTheme.getHoverColors(lightTheme, { isDarkMode: false })
    },
    {
      mode: 'dark',
      theme: faviconTheme.getThemeForMode(lightTheme, { isDarkMode: true }),
      base: [48, 48, 48],
      hover: faviconTheme.getHoverColors(lightTheme, { isDarkMode: true })
    }
  ];

  variants.forEach(({ mode, theme, base, hover }) => {
    const label = `${accent.join(',')} ${mode}`;
    assertContrast(theme.highlightBg, base, 1.18, `${label} selected-row surface`);
    assertContrast(hover.bg, base, 1.12, `${label} hover surface`);
    assertContrast(hover.text, hover.bg, 4.5, `${label} hover-themed text`);
    assertContrast(theme.accent, theme.highlightBg, 4.5, `${label} themed icon`);
    assertContrast(theme.placeholderText, base, 4.5, `${label} themed placeholder`);
    assertContrast(theme.markText, theme.markBg, 4.5, `${label} highlighted text`);
    const expectedPassiveMarkBg = faviconTheme.mixColor(
      faviconTheme.getSaturationCappedColor(
        theme.accentRgb,
        mode === 'dark' ? 0.6 : 0.68
      ),
      base,
      mode === 'dark' ? 0.74 : 0.78
    );
    assert.deepStrictEqual(
      parseThemeColor(theme.markBg),
      expectedPassiveMarkBg,
      `${label} non-selected match should keep its original subtle surface`
    );
    assertContrast(
      theme.activeMarkText,
      theme.activeMarkBg,
      4.5,
      `${label} selected-row highlighted text`
    );
    assertContrast(
      theme.activeMarkBg,
      theme.highlightBg,
      1.4,
      `${label} highlighted match on selected row`
    );
    assertContrast(theme.tagText, theme.tagBg, 4.5, `${label} action tag text`);
    assertContrast(theme.keyText, theme.keyBg, 4.5, `${label} shortcut key text`);
    assertContrast(theme.buttonText, theme.buttonBg, 4.5, `${label} action button text`);
    assertContrast(theme.highlightBorder, base, 3, `${label} highlight boundary`);
    assertSoftBoundary(theme.tagBorder, theme.tagBg, `${label} action tag boundary`);
    assertSoftBoundary(theme.keyBorder, theme.keyBg, `${label} shortcut key boundary`);
    assertSoftBoundary(theme.buttonBorder, theme.buttonBg, `${label} action button boundary`);
  });
});

assertContrast(
  '#667085',
  '#F3F4F6',
  4.5,
  'neutral source tag text'
);
assertContrast(
  '#111827',
  '#E5E7EB',
  4.5,
  'neutral passive match text'
);

const yellowTheme = faviconTheme.buildTheme([255, 193, 7]);
const redTheme = faviconTheme.buildTheme([255, 0, 0]);
assert.deepStrictEqual(
  yellowTheme.accentRgb,
  [255, 193, 7],
  'contrast correction should retain the source brand color for tinted surfaces'
);
assert.notStrictEqual(
  yellowTheme.accent,
  'rgb(255, 193, 7)',
  'bright brand foregrounds should be corrected instead of disappearing on light rows'
);
assert.ok(
  getHslSaturation(yellowTheme.highlightBg) >= 0.62 &&
    getHslSaturation(yellowTheme.highlightBg) <= 0.7,
  'large yellow result surfaces should stay colorful without returning to a high-saturation pastel'
);
assert.ok(
  getHslSaturation(redTheme.highlightBg) >= 0.62 &&
    getHslSaturation(redTheme.highlightBg) <= 0.7,
  'red result surfaces should remain visibly related to the saturated search-scope badge'
);
assert.ok(
  getHslSaturation(faviconTheme.getSaturationCappedColor([255, 0, 0], 0.68)) <= 0.69,
  'surface palette generation should cap saturation consistently across brand hues'
);

const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const newtabHtml = readPageSource('newtab.html');
const overlayCss = fs.readFileSync('src/overlay/suggestions-view.css', 'utf8');
const overlayInjectionIndex = backgroundSource.indexOf('const overlayInjectionFiles = [');
const sharedThemeIndex = backgroundSource.indexOf(
  "'src/newtab/favicon-theme.js'",
  overlayInjectionIndex
);
const overlayIndex = backgroundSource.indexOf(
  "'src/overlay/search-panel.js'",
  overlayInjectionIndex
);
assert.ok(
  overlayInjectionIndex >= 0 && sharedThemeIndex >= 0 && sharedThemeIndex < overlayIndex,
  'overlay injection should load the shared theme algorithm before the search panel'
);
assert.ok(
  overlaySource.includes('const FAVICON_THEME = globalThis.LumnoNewtabFaviconTheme;') &&
    overlaySource.includes('return FAVICON_THEME.getThemeForMode(theme, {') &&
    overlaySource.includes('return FAVICON_THEME.getHoverColors(theme, {'),
  'overlay and New Tab search results should use the same contrast-aware theme algorithm'
);
assert.doesNotMatch(
  overlaySource,
  /function buildThemeVariant\(/,
  'overlay should not keep a second theme palette implementation'
);
assert.match(
  newtabHtml,
  /\.x-nt-suggestion-action-button:focus-visible,[\s\S]*?\.x-nt-suggestion-utility-button:focus-visible[\s\S]*?outline:\s*2px solid currentColor;/,
  'New Tab should preserve a strong keyboard focus indicator when passive borders are softened'
);
assert.match(
  overlayCss,
  /\.x-ov-suggestion-action-button:focus-visible,[\s\S]*?\.x-ov-suggestion-utility-button:focus-visible[\s\S]*?outline:\s*2px solid currentColor;/,
  'overlay should preserve a strong keyboard focus indicator when passive borders are softened'
);

console.log('theme color contrast tests passed');
