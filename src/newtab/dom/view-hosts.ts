// The elements the page's views draw into through portals: made here,
// outside React, and placed by the parts that own them.
interface ViewHostOptions {
  id?: string;
  className?: string;
  // Data attributes, by their dataset names.
  data?: Record<string, string>;
  attributes?: Record<string, string>;
  hidden?: boolean;
}

function createViewHost<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  options: ViewHostOptions = {}
): HTMLElementTagNameMap[K] {
  const host = doc.createElement(tag);
  if (options.id) {
    host.id = options.id;
  }
  if (options.className) {
    host.className = options.className;
  }
  Object.entries(options.data || {}).forEach(([name, value]) => {
    host.dataset[name] = value;
  });
  Object.entries(options.attributes || {}).forEach(([name, value]) => {
    host.setAttribute(name, value);
  });
  if (options.hidden) {
    host.hidden = true;
  }
  return host;
}

// Takes away an element an earlier page left under this id.
function removeElementById(doc: Document, id: string): void {
  doc.getElementById(id)?.remove();
}

export { createViewHost, removeElementById };
export type { ViewHostOptions };
