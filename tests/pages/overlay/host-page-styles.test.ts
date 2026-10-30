import { describe, expect, it } from 'vitest';
import { bootOverlayPage, settle } from './boot';
import { getElement, required } from '../../fakes/dom';
import { readRepoFile } from '../../fakes/css';

// The overlay draws inside a closed shadow root. Only @font-face rules reach
// the host document (Chrome ignores them inside shadow roots), under
// Lumno-only family names, so they cannot restyle or re-font the page.

const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';

function hostStyleNodes(): Element[] {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .filter((node) => !node.closest(`#${OVERLAY_HOST_ID}`));
}

function isFontFaceRule(rule: CSSRule): rule is CSSFontFaceRule {
  return 'style' in rule && rule.cssText.startsWith('@font-face');
}

describe('Overlay styles in the host page', () => {
  it('adds one style of Lumno-only font faces to the page and leaves page icons alone', async () => {
    const hostIcon = document.body.appendChild(document.createElement('i'));
    hostIcon.className = 'ri-home-line';
    const plainIcon = document.body.appendChild(document.createElement('i'));
    const before = hostStyleNodes();
    const page = await bootOverlayPage();
    await page.open();

    const added = hostStyleNodes().filter((node) => !before.includes(node));
    expect(added.filter((node) => node.tagName === 'LINK')).toEqual([]);
    expect(added).toHaveLength(1);
    const fontFaces = added[0];
    const sheet = fontFaces instanceof HTMLStyleElement ? fontFaces.sheet : null;
    const rules = Array.from(required(sheet, 'the font-face sheet').cssRules);
    expect(rules.length).toBeGreaterThanOrEqual(1);
    rules.forEach((rule) => expect(rule.cssText.startsWith('@font-face')).toBe(true));
    const families = rules.filter(isFontFaceRule).map((rule) => rule.style.getPropertyValue('font-family').replace(/["']/g, ''));
    // Not the page-visible "Open Sans" or "remixicon" names.
    expect([...new Set(families)].sort()).toEqual(['Lumno Open Sans', 'lumno-remixicon']);
    expect(fontFaces.textContent).toMatch(/remixicon\.woff2/);
    expect(fontFaces.textContent).toMatch(/OpenSans-VariableFont/);
    expect(getComputedStyle(hostIcon).fontFamily).toBe(getComputedStyle(plainIcon).fontFamily);

    page.toggle();
    await settle();
    page.toggle();
    await settle();
    expect(hostStyleNodes().filter((node) => !before.includes(node))).toHaveLength(1);
  });

  it('loads the icon class rules in the shadow root, before the overlay styles that re-point them', async () => {
    const page = await bootOverlayPage();
    const root = await page.open();
    const iconSheet = getElement(root, '#_x_extension_remixicon_shadow_css_2026_unique_');
    const suggestionsSheet = getElement(root, '#_x_extension_overlay_suggestions_style_2026_unique_');
    expect(iconSheet.compareDocumentPosition(suggestionsSheet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The scoped face override's selector covers the overlay's icon markup.
    expect(getElement(root, 'i.ri-icon').matches('[class^="ri-"], [class*=" ri-"]')).toBe(true);
  });

  it('makes overlay icon classes prefer the Lumno-scoped icon face over remixicon.css', () => {
    const sheets = ['assets/remixicon/fonts/remixicon.css', 'src/overlay/suggestions-view.css'].map((file) => {
      const style = document.createElement('style');
      style.textContent = readRepoFile(file);
      return document.head.appendChild(style);
    });
    const icon = document.body.appendChild(document.createElement('i'));
    icon.className = 'ri-icon ri-size-16 ri-close-line';
    try {
      expect(getComputedStyle(icon).fontFamily).toMatch(/^"?lumno-remixicon"?,/);
    } finally {
      sheets.forEach((style) => style.remove());
    }
  });
});
