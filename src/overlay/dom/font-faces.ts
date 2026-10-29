// The overlay's font faces on the host document (see overlay-font-faces.ts),
// unless the page registered them while it loaded. The icon class rules load
// inside the overlay's shadow root (remixicon.css, re-pointed at the scoped
// face by suggestions-view.css).
import * as OVERLAY_FONT_FACES from '../../shared/overlay-font-faces';
import { getRuntimeUrl } from '../runtime';

const FONT_FACES_STYLE_ID = '_x_extension_overlay_font_faces_2026_unique_';

// Adds the faces once; false when the page already has them.
function installOverlayFontFaces(doc: Document, win: Window): boolean {
  const host = doc.head || doc.documentElement;
  if (!host || doc.getElementById(FONT_FACES_STYLE_ID) ||
      OVERLAY_FONT_FACES.hasEarlyOverlayFontFaces(win)) {
    return false;
  }
  const style = doc.createElement('style');
  style.id = FONT_FACES_STYLE_ID;
  style.textContent = OVERLAY_FONT_FACES.buildOverlayFontFaceCss(
    (assetPath) => getRuntimeUrl(chrome, assetPath)
  );
  host.appendChild(style);
  return true;
}

export { installOverlayFontFaces };
