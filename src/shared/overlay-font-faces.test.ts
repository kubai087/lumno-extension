import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasEarlyOverlayFontFaces, keepEarlyCjkFontFace, registerEarlyOverlayFontFaces } from './overlay-font-faces';
import { installFontFaceApi, removeFontFaceApi } from '../../tests/fakes/font-faces';
import { required } from '../../tests/fakes/dom';

const getUrl = (assetPath: string) => `chrome-extension://lumno/${assetPath}`;

afterEach(() => {
  removeFontFaceApi();
});

describe('early overlay font faces', () => {
  it('registers the text bands, the icon face and the CJK face for the browser language', () => {
    const added = installFontFaceApi();
    expect(registerEarlyOverlayFontFaces(window, { getUrl, lang: 'zh-CN' })).toBe(true);
    const faces = Array.from(added);
    expect(faces.map((face) => [face.family, face.weight])).toEqual([
      ['Lumno Open Sans', '300 549'],
      ['Lumno Open Sans', '550 649'],
      ['Lumno Open Sans', '650 800'],
      ['lumno-remixicon', 'normal'],
      ['Lumno Open Sans', '550 649']
    ]);
    expect(faces[0].source).toMatch(/^url\("chrome-extension:\/\/lumno\/assets\/fonts\/open-sans\/OpenSans-VariableFont-wdth-wght\.woff2"\) format\("woff2"\)$/);
    expect(faces[0].display).toBe('swap');
    expect(faces[4].source).toMatch(/PingFangSC-Medium/);
    // The CJK face covers CJK text only.
    expect(faces[4].unicodeRange).toMatch(/U\+4E00-9FFF/);
    // The page's DOM stays untouched.
    expect(document.head.children).toHaveLength(0);
    expect(hasEarlyOverlayFontFaces(window)).toBe(true);
  });

  it('registers the faces once per page', () => {
    const added = installFontFaceApi();
    registerEarlyOverlayFontFaces(window, { getUrl, lang: 'zh-CN' });
    expect(registerEarlyOverlayFontFaces(window, { getUrl, lang: 'zh-CN' })).toBe(false);
    expect(added.size).toBe(5);
  });

  it('has the overlay declare the faces again once the page dropped one', () => {
    const added = installFontFaceApi();
    registerEarlyOverlayFontFaces(window, { getUrl, lang: 'zh-CN' });
    added.delete(required(Array.from(added)[0], 'first face'));
    expect(hasEarlyOverlayFontFaces(window)).toBe(false);
  });

  it('keeps the early CJK face only for a language with the same glyph forms', () => {
    const added = installFontFaceApi();
    registerEarlyOverlayFontFaces(window, { getUrl, lang: 'zh-CN' });
    const cjkFace = Array.from(added)[4];
    expect(keepEarlyCjkFontFace(window, 'zh-SG')).toBe(true);
    expect(keepEarlyCjkFontFace(window, 'zh-TW')).toBe(false);
    expect(added.has(cjkFace)).toBe(false);
    // Once removed, the caller installs the face the setting needs.
    expect(keepEarlyCjkFontFace(window, 'zh-CN')).toBe(false);
  });

  it('registers no CJK face for a language without one', () => {
    const added = installFontFaceApi();
    registerEarlyOverlayFontFaces(window, { getUrl, lang: 'en-US' });
    expect(added.size).toBe(4);
    expect(keepEarlyCjkFontFace(window, 'ja')).toBe(false);
  });

  it('leaves the overlay to declare the faces when registering fails', () => {
    installFontFaceApi();
    vi.stubGlobal('FontFace', function refuse() {
      throw new Error('Permission denied');
    });
    expect(registerEarlyOverlayFontFaces(window, { getUrl, lang: 'ja' })).toBe(false);
    expect(hasEarlyOverlayFontFaces(window)).toBe(false);
  });
});
