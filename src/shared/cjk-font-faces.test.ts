import { afterEach, describe, expect, it } from 'vitest';
import { FONT_WEIGHT_BAND, buildFontFaceCss, install, watchFromCurrentScript } from './cjk-font-faces';
import { buildOverlayFontFaceCss } from './overlay-font-faces';
import { readRepoFile } from '../../tests/fakes/css';

// The CJK face only composes with Open Sans when its weight band matches one
// of the Open Sans faces exactly, on pages and in the overlay alike.

const PAGE_STYLE_ID = '_x_extension_cjk_font_faces_2026_unique_';
const OPEN_SANS_BANDS = [...readRepoFile('assets/fonts/open-sans/open-sans.css').matchAll(/font-weight:\s*([\d ]+);/g)]
  .map((match) => match[1].trim());

afterEach(() => {
  document.head.replaceChildren();
  document.documentElement.lang = '';
});

describe('CJK font faces', () => {
  it('joins the middle Open Sans weight band', () => {
    expect(OPEN_SANS_BANDS).toEqual(['300 549', '550 649', '650 800']);
    expect(OPEN_SANS_BANDS).toContain(FONT_WEIGHT_BAND);
  });

  it('declares the overlay text family in the same weight bands as the pages', () => {
    const css = buildOverlayFontFaceCss((path) => `chrome-extension://lumno/${path}`);
    const bands = [...css.matchAll(/@font-face \{[^}]*font-family: "Lumno Open Sans";[^}]*font-weight: ([\d ]+);/g)].map((match) => match[1].trim());

    expect(bands).toEqual(OPEN_SANS_BANDS);
  });

  it.each([
    ['zh-CN', 'PingFangSC-Medium'],
    ['zh', 'PingFangSC-Medium'],
    ['zh-TW', 'PingFangTC-Medium'],
    ['zh-Hant-HK', 'PingFangTC-Medium'],
    ['ja', 'HiraginoSans-W5']
  ])('draws %s CJK text at Medium from %s for CJK characters only', (lang, face) => {
    const css = buildFontFaceCss('Open Sans', lang);

    expect(css).toContain(`local("${face}")`);
    expect(css).toContain(`font-weight: ${FONT_WEIGHT_BAND};`);
    expect(css).toMatch(/unicode-range: [^;]*U\+4E00-9FFF/);
  });

  it('declares nothing without a CJK language or a family', () => {
    expect(buildFontFaceCss('Open Sans', 'en')).toBe('');
    expect(buildFontFaceCss('Open Sans', '')).toBe('');
    expect(buildFontFaceCss('', 'zh-CN')).toBe('');
  });

  it('installs one style, rewrites it for another language and removes it for one without a CJK face', () => {
    const styleId = 'cjk-test-style';
    const style = () => document.getElementById(styleId);

    install(document, { family: 'Lumno Open Sans', lang: 'zh-CN', styleId });
    expect(style()?.textContent).toContain('PingFangSC-Medium');
    install(document, { family: 'Lumno Open Sans', lang: 'ja', styleId });
    expect(document.querySelectorAll(`#${styleId}`)).toHaveLength(1);
    expect(style()?.textContent).toContain('HiraginoSans-W5');
    install(document, { family: 'Lumno Open Sans', lang: 'en', styleId });
    expect(style()).toBeNull();
  });

  it('follows <html lang> on a page whose script tag names the family', async () => {
    const script = document.createElement('script');
    script.dataset.fontFamily = 'Open Sans';
    const pageDocument = document.implementation.createHTMLDocument('page');
    pageDocument.documentElement.lang = 'zh-CN';
    Object.defineProperty(pageDocument, 'currentScript', { value: script, configurable: true });
    const face = () => pageDocument.getElementById(PAGE_STYLE_ID)?.textContent || '';
    const languageChanged = () => new Promise((resolve) => setTimeout(resolve, 0));

    watchFromCurrentScript(pageDocument);
    expect(face()).toContain('PingFangSC-Medium');
    pageDocument.documentElement.lang = 'zh-TW';
    await languageChanged();
    expect(face()).toContain('PingFangTC-Medium');
    pageDocument.documentElement.lang = 'en';
    await languageChanged();
    expect(face()).toBe('');
  });
});
