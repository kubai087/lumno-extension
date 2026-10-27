// Fills a message's {name} placeholders; a placeholder with no value stays
// as written.
function formatTemplate(text: string, params: Record<string, string | number>): string {
  return String(text || '').replace(/\{(\w+)\}/g, (match, key: string) => {
    if (params && Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
}

export { formatTemplate };
