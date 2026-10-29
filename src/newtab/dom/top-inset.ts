// How much of the viewport's top the page keeps clear: the visual viewport's
// inset and the bookmarks bar while it is shown at the top. Menus, the
// folder menu and the layout start below it.
import { BOOKMARK_TOPBAR_HEIGHT_PX } from '../react/bookmarks-topbar';
import { getNewtabVisualViewportInsets } from '../viewport-insets';

const NEWTAB_FLOATING_TOP_GAP_PX = 12;
const BOOKMARK_CASCADE_TOPBAR_GAP_PX = 4;
// Matches the floating bar's 8px top offset and 40px height in styles/bookmarks-topbar.css.
const BOOKMARK_TOPBAR_FLOATING_OCCUPIED_PX = 48;

function getNewtabTopOccupiedInsetPx(): number {
  const visualViewportTopInset = getNewtabVisualViewportInsets().top;
  const body = document.body;
  const bookmarkTopbarInset = body && body.getAttribute('data-nt-top-occupied') === 'true'
    ? (body.getAttribute('data-nt-top-layout') === 'floating'
      ? BOOKMARK_TOPBAR_FLOATING_OCCUPIED_PX
      : BOOKMARK_TOPBAR_HEIGHT_PX)
    : 0;
  return visualViewportTopInset + bookmarkTopbarInset;
}

function getNewtabViewportTopPaddingPx(): number {
  return getNewtabTopOccupiedInsetPx() + Math.min(8, NEWTAB_FLOATING_TOP_GAP_PX);
}

function getBookmarkCascadeViewportTopPaddingPx(): number {
  const occupiedTopInset = getNewtabTopOccupiedInsetPx();
  return occupiedTopInset > 0
    ? occupiedTopInset + BOOKMARK_CASCADE_TOPBAR_GAP_PX
    : 8;
}

export { getBookmarkCascadeViewportTopPaddingPx, getNewtabTopOccupiedInsetPx, getNewtabViewportTopPaddingPx };
