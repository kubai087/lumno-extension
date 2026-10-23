const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const {
  createOverlayPage,
  openAndSettle,
  settle
} = require('../helpers/overlay-runtime-harness');

// The overlay renders inside a closed shadow root. Only @font-face rules may
// reach the host document (Chrome ignores them inside shadow roots), and they
// must use Lumno-only family names so they cannot restyle or re-font the page.

function listHostStyleNodes(document) {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .filter((node) => !node.closest('#_x_extension_overlay_host_2026_unique_'));
}

(async () => {
  const page = await createOverlayPage();
  const { window } = page;
  const { document } = window;
  try {
    const hostIcon = document.createElement('i');
    hostIcon.className = 'ri-home-line';
    document.body.appendChild(hostIcon);
    const plainIcon = document.body.appendChild(document.createElement('i'));
    const stylesBefore = listHostStyleNodes(document);

    await openAndSettle(page);
    const addedStyles = listHostStyleNodes(document)
      .filter((node) => !stylesBefore.includes(node));

    assert.deepStrictEqual(
      addedStyles.filter((node) => node.tagName === 'LINK').map((node) => node.href),
      [],
      'opening the overlay must not link any stylesheet into the host page'
    );
    assert.strictEqual(addedStyles.length, 1,
      'the overlay should add exactly one font-face style to the host page');
    const fontFaceStyle = addedStyles[0];
    const hostRules = Array.from(fontFaceStyle.sheet.cssRules);
    assert.ok(hostRules.length >= 1);
    hostRules.forEach((rule) => {
      assert.ok(rule.cssText.startsWith('@font-face'),
        `only @font-face rules may reach the host page, found: ${rule.cssText}`);
    });
    const families = hostRules.map((rule) => rule.style.getPropertyValue('font-family').replace(/["']/g, ''));
    assert.deepStrictEqual([...new Set(families)].sort(), ['Lumno Open Sans', 'lumno-remixicon'],
      'host-level faces must not reuse the page-visible "Open Sans" or "remixicon" family names');
    assert.ok(/remixicon\.woff2/.test(fontFaceStyle.textContent));
    assert.ok(/OpenSans-VariableFont/.test(fontFaceStyle.textContent));
    assert.strictEqual(window.getComputedStyle(hostIcon).fontFamily, window.getComputedStyle(plainIcon).fontFamily,
      'host-page elements with ri-* classes must keep their own styling');

    const panel = window.LumnoOverlayShell.findOverlayPanel(document);
    const root = panel._lumnoOverlayRoot;
    assert.ok(root.querySelector('#_x_extension_remixicon_shadow_css_2026_unique_'),
      'icon class rules should load inside the overlay shadow root');
    const suggestionsSheet = root.querySelector('#_x_extension_overlay_suggestions_style_2026_unique_');
    const iconSheet = root.querySelector('#_x_extension_remixicon_shadow_css_2026_unique_');
    assert.ok(suggestionsSheet, 'overlay component styles should load inside the shadow root');
    assert.ok(
      iconSheet.compareDocumentPosition(suggestionsSheet) & window.Node.DOCUMENT_POSITION_FOLLOWING,
      'the scoped icon-face override must load after remixicon.css'
    );
    // Apply the two sheets in their shadow-root order and check the cascade.
    const cascadeDom = new JSDOM(`<!doctype html><style>${
      fs.readFileSync(path.join(__dirname, '../../assets/remixicon/fonts/remixicon.css'), 'utf8')
    }</style><style>${
      fs.readFileSync(path.join(__dirname, '../../src/overlay/suggestions-view.css'), 'utf8')
    }</style><i class="ri-icon ri-size-16 ri-close-line"></i>`);
    const cascadeIcon = cascadeDom.window.document.querySelector('i');
    assert.match(cascadeDom.window.getComputedStyle(cascadeIcon).fontFamily, /^"?lumno-remixicon"?,/,
      'overlay icon classes should prefer the Lumno-scoped icon face');
    cascadeDom.window.close();
    const overlayIcon = root.querySelector('i.ri-icon');
    assert.ok(overlayIcon, 'the overlay should render icon-font glyphs');
    assert.ok(overlayIcon.matches('[class^="ri-"], [class*=" ri-"]'),
      'the icon face override selector should cover the overlay icon markup');

    page.toggle();
    await settle();
    page.toggle();
    await settle();
    assert.strictEqual(
      listHostStyleNodes(document).filter((node) => !stylesBefore.includes(node)).length,
      1,
      'reopening the overlay should reuse the single font-face style'
    );
  } finally {
    window.close();
  }
  console.log('overlay host page style isolation tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
