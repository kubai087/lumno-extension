// The <link> in the page's head that carries the New Tab's favicon, made
// the first time it is asked for; null without a head.
function getPageFaviconLink(doc: Document): HTMLLinkElement | null {
  const head = doc.head;
  if (!head) {
    return null;
  }
  const existing = Array.from(head.children).find((child): child is HTMLLinkElement =>
    String(child.tagName || '').toUpperCase() === 'LINK' &&
    child.getAttribute('data-lumno-newtab-favicon') === 'true');
  if (existing) {
    return existing;
  }
  const link = doc.createElement('link');
  link.setAttribute('data-lumno-newtab-favicon', 'true');
  head.appendChild(link);
  return link;
}

export { getPageFaviconLink };
