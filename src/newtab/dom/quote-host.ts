// The quote line's host, hidden until a quote is shown; it moves between
// slots on the page with the chosen position.
function createQuoteHost(doc: Document): HTMLDivElement {
  const element = doc.createElement('div');
  element.className = 'x-nt-quote';
  element.hidden = true;
  return element;
}

export { createQuoteHost };
