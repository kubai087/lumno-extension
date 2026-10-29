// The address of a file packaged with the extension.
function getExtensionResourceUrl(resourcePath: unknown): string {
  const normalizedPath = String(resourcePath || '').replace(/^\/+/, '');
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
    return chrome.runtime.getURL(normalizedPath);
  }
  const baseUrl = document.baseURI || window.location.href;
  return new URL(`../../${normalizedPath}`, baseUrl).href;
}

export { getExtensionResourceUrl };
