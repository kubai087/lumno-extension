// The element the New Tab's React root lives in. It draws nothing itself:
// the page's views are portals into their own places.
const APP_ROOT_ID = '_x_extension_newtab_app_root_2026_unique_';

function createAppRootContainer(doc: Document): HTMLElement {
  const container = doc.createElement('div');
  container.id = APP_ROOT_ID;
  container.hidden = true;
  doc.body.appendChild(container);
  return container;
}

export { createAppRootContainer };
