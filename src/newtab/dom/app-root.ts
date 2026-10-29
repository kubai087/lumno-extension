// The element the New Tab's React root lives in, which draws nothing itself
// (the page's views are portals into their own places), and the page's root
// the sections are placed around.
const APP_ROOT_ID = '_x_extension_newtab_app_root_2026_unique_';

function createAppRootContainer(doc: Document): HTMLElement {
  const container = doc.createElement('div');
  container.id = APP_ROOT_ID;
  container.hidden = true;
  doc.body.appendChild(container);
  return container;
}

// The page's root in the New Tab markup; null on a page without one.
function getPageRoot(doc: Document): HTMLElement | null {
  return doc.getElementById('_x_extension_newtab_root_2024_unique_');
}

// The element the page's toasts draw in.
function getToastElement(doc: Document): HTMLElement | null {
  return doc.getElementById('_x_extension_toast_2024_unique_');
}

export { createAppRootContainer, getPageRoot, getToastElement };
