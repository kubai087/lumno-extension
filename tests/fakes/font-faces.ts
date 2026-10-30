// The FontFace API, which JSDOM lacks: a FontFace class and document.fonts
// as a plain set, so a test sees which faces a page registered.
import { vi } from 'vitest';

class FakeFontFace {
  family: string;
  source: string;
  style = 'normal';
  weight = 'normal';
  unicodeRange = 'U+0-10FFFF';
  display = 'auto';

  constructor(family: string, source: string, descriptors: FontFaceDescriptors = {}) {
    this.family = family;
    this.source = source;
    Object.assign(this, descriptors);
  }
}

// Installs the API on the test window; returns the faces document.fonts holds.
function installFontFaceApi(): Set<FakeFontFace> {
  const added = new Set<FakeFontFace>();
  vi.stubGlobal('FontFace', FakeFontFace);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      add(face: FakeFontFace) {
        added.add(face);
        return this;
      },
      has: (face: FakeFontFace) => added.has(face),
      delete: (face: FakeFontFace) => added.delete(face),
      [Symbol.iterator]: () => added.values()
    }
  });
  return added;
}

// Removes the API and what the extension's isolated world remembered of it.
function removeFontFaceApi(): void {
  Reflect.deleteProperty(document, 'fonts');
  Reflect.deleteProperty(globalThis, '__lumnoContent');
  vi.unstubAllGlobals();
}

export { FakeFontFace, installFontFaceApi, removeFontFaceApi };
