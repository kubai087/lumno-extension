// Which elements are shortcut tiles.

// Whether a folder menu opened from a folder shortcut, not a bookmark.
function isShortcutFolderAnchor(element: Element | null | undefined): boolean {
  return Boolean(element && element.classList.contains('x-nt-shortcut-tile'));
}

export { isShortcutFolderAnchor };
