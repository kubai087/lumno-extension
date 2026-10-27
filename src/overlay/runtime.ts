
// What the overlay needs of the chrome API to find its own files.
interface RuntimeUrlApi {
  runtime?: { getURL?(path: string): string } | null;
}


function getRuntimeUrl(chromeApi: RuntimeUrlApi | null, path: string): string {
  const runtime = chromeApi ? chromeApi.runtime : null;
  return runtime && typeof runtime.getURL === 'function'
    ? runtime.getURL(path)
    : path;
}

function isInjectedBrowserExtensionProtocol(protocol: string): boolean {
  const normalized = String(protocol || '').toLowerCase();
  return normalized === 'chrome-extension:' ||
    normalized === 'moz-extension:' ||
    normalized === 'ms-browser-extension:';
}

export {
  getRuntimeUrl,
  isInjectedBrowserExtensionProtocol
};
export type { RuntimeUrlApi };
