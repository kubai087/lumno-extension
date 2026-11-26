const SEARCH_FALLBACK_PARAM = 'searchFallback';

const ROUTE_PATHS = Object.freeze({
  newtab: 'newtab.html',
  legacyNewtab: 'src/newtab/newtab.html',
  lumnoNewtab: 'src/newtab/lumno-newtab.html',
  onboarding: 'src/onboarding/onboarding.html',
  options: 'src/options/options.html',
  optionsAppearance: 'src/options/options.html#appearance'
});

// The part of the extension API that turns a packaged path into a URL.
interface RuntimeUrlApi {
  runtime?: { getURL?: (path: string) => string };
}

type RouteParams = Record<string, string | number | boolean | null | undefined>;

type ExtensionPageKind = 'newtab' | 'options' | 'onboarding' | 'other';

function hasRuntimeGetUrl(chromeApi: RuntimeUrlApi | null | undefined): chromeApi is { runtime: { getURL: (path: string) => string } } {
  return Boolean(
    chromeApi &&
    chromeApi.runtime &&
    typeof chromeApi.runtime.getURL === 'function'
  );
}

function buildExtensionUrl(chromeApi: RuntimeUrlApi | null | undefined, routePath: unknown): string {
  const value = String(routePath || '').trim();
  if (!value) {
    return '';
  }
  if (/^(https?:|chrome:|edge:|brave:|vivaldi:|opera:|about:|file:)/i.test(value)) {
    return value;
  }
  if (hasRuntimeGetUrl(chromeApi)) {
    return chromeApi.runtime.getURL(value);
  }
  return value;
}

function setUrlParam(url: URL, key: string, value: RouteParams[string]) {
  if (value === undefined || value === null || value === false) {
    return;
  }
  if (value === true) {
    url.searchParams.set(key, '1');
    return;
  }
  url.searchParams.set(key, String(value));
}

function buildRouteUrl(chromeApi: RuntimeUrlApi | null | undefined, routePath: string, params?: RouteParams | null): string {
  const baseUrl = buildExtensionUrl(chromeApi, routePath);
  const url = new URL(baseUrl, 'chrome-extension://lumno/');
  const nextParams: RouteParams = params && typeof params === 'object' ? params : {};
  Object.keys(nextParams).sort().forEach((key) => {
    setUrlParam(url, key, nextParams[key]);
  });
  return url.toString();
}

function buildNewtabUrl(chromeApi: RuntimeUrlApi | null | undefined, params?: RouteParams | null): string {
  return buildRouteUrl(chromeApi, ROUTE_PATHS.newtab, params);
}

function buildLumnoNewtabUrl(chromeApi: RuntimeUrlApi | null | undefined, params?: RouteParams | null): string {
  return buildRouteUrl(chromeApi, ROUTE_PATHS.lumnoNewtab, params);
}

function buildOptionsUrl(chromeApi: RuntimeUrlApi | null | undefined, hash?: string): string {
  const baseRoute = hash ? ROUTE_PATHS.options : ROUTE_PATHS.options;
  const url = new URL(
    buildExtensionUrl(chromeApi, baseRoute),
    'chrome-extension://lumno/'
  );
  const normalizedHash = String(hash || '').trim();
  if (normalizedHash) {
    url.hash = normalizedHash.startsWith('#') ? normalizedHash.slice(1) : normalizedHash;
  }
  return url.toString();
}

function getPathname(url: unknown): string {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(String(url));
    return String(parsed.pathname || '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function pathMatchesRoute(pathname: string, routePath: string): boolean {
  const route = `/${String(routePath || '').split(/[?#]/)[0].toLowerCase()}`;
  return pathname === route || pathname.endsWith(route);
}

function isNewtabUrl(url: unknown): boolean {
  const pathname = getPathname(url);
  return pathMatchesRoute(pathname, ROUTE_PATHS.newtab) ||
    pathMatchesRoute(pathname, ROUTE_PATHS.legacyNewtab) ||
    pathMatchesRoute(pathname, ROUTE_PATHS.lumnoNewtab);
}

function isOptionsUrl(url: unknown): boolean {
  return pathMatchesRoute(getPathname(url), ROUTE_PATHS.options);
}

function isOnboardingUrl(url: unknown): boolean {
  return pathMatchesRoute(getPathname(url), ROUTE_PATHS.onboarding);
}

function classifyExtensionUrl(url: unknown): ExtensionPageKind {
  if (isNewtabUrl(url)) {
    return 'newtab';
  }
  if (isOptionsUrl(url)) {
    return 'options';
  }
  if (isOnboardingUrl(url)) {
    return 'onboarding';
  }
  return 'other';
}

export {
  ROUTE_PATHS,
  SEARCH_FALLBACK_PARAM,
  buildExtensionUrl,
  buildNewtabUrl,
  buildLumnoNewtabUrl,
  buildOptionsUrl,
  isNewtabUrl,
  isOptionsUrl,
  isOnboardingUrl,
  classifyExtensionUrl
};
export type { ExtensionPageKind, RouteParams, RuntimeUrlApi };
