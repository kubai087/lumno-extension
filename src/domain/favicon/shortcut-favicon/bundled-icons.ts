// The bundled artwork for known sites and site-search providers.
import { getCacheKey, lookup, normalizeCacheMap, normalizePageUrl } from './persisted';
import type { IconProvider, SiteSearchIconOptions } from './types';

const GOOGLE_BRAND_ICON_URL =
  'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
const SITE_SEARCH_PINNED_ICON_ASSETS: Readonly<Record<string, string>> = Object.freeze({
  yt: 'assets/images/site-search/tile-yt.png',
  bb: 'assets/images/site-search/tile-bb.png',
  gh: 'assets/images/site-search/tile-gh.png',
  sf: 'assets/images/site-search/tile-sf.png',
  mdn: 'assets/images/site-search/tile-mdn.png',
  npm: 'assets/images/site-search/tile-npm.png',
  hf: 'assets/images/site-search/tile-hf.png',
  gs: 'assets/images/site-search/tile-gs.png',
  ss: 'assets/images/site-search/tile-ss.png',
  maps: 'assets/images/site-search/tile-maps.png',
  gpt: 'assets/images/site-search/tile-gpt.png',
  gm: 'assets/images/site-search/tile-gm.png',
  dbai: 'assets/images/site-search/tile-dbai.png',
  qw: 'assets/images/site-search/tile-qw.png',
  yb: 'assets/images/site-search/tile-yb.png',
  mx: 'assets/images/site-search/tile-mx.png',
  ds: 'assets/images/site-search/tile-ds.png',
  kimi: 'assets/images/site-search/tile-kimi.png',
  cp: 'assets/images/site-search/tile-cp.png',
  grok: 'assets/images/site-search/tile-grok.png',
  qwen: 'assets/images/site-search/tile-qwen.png',
  ais: 'assets/images/site-search/tile-ais.png',
  pplx: 'assets/images/site-search/tile-pplx.png',
  metaso: 'assets/images/site-search/tile-metaso.png',
  felo: 'assets/images/site-search/tile-felo.png',
  bd: 'assets/images/site-search/tile-bd.png',
  bi: 'assets/images/site-search/tile-bi.png',
  gg: 'assets/images/site-search/tile-gg.png',
  kg: 'assets/images/site-search/tile-kg.png',
  ddg: 'assets/images/site-search/tile-ddg.png',
  br: 'assets/images/site-search/tile-br.png',
  eco: 'assets/images/site-search/tile-eco.png',
  sg: 'assets/images/site-search/tile-sg.png',
  yh: 'assets/images/site-search/tile-yh.png',
  yx: 'assets/images/site-search/tile-yx.png',
  sm: 'assets/images/site-search/tile-sm.png',
  ybs: 'assets/images/site-search/tile-ybs.png',
  zh: 'assets/images/site-search/tile-zh.png',
  db: 'assets/images/site-search/tile-db.png',
  jj: 'assets/images/site-search/tile-jj.png',
  wx: 'assets/images/site-search/tile-wx.png',
  tb: 'assets/images/site-search/tile-tb.png',
  tm: 'assets/images/site-search/tile-tm.png',
  tw: 'assets/images/site-search/tile-tw.png',
  rd: 'assets/images/site-search/tile-rd.png',
  wb: 'assets/images/site-search/tile-wb.png',
  xhs: 'assets/images/site-search/tile-xhs.png',
  dy: 'assets/images/site-search/tile-dy.png',
  jd: 'assets/images/site-search/tile-jd.png',
  wk: 'assets/images/site-search/tile-wk.png',
  zw: 'assets/images/site-search/tile-zw.png',
  lm: 'assets/images/site-search/tile-lm.png'
});
// Shortcuts supply their own themed tile. Load the original artwork without
// the background and rounded mask baked into the search-provider tiles.
const SHORTCUT_PINNED_ICON_ASSETS: Readonly<Record<string, string>> = Object.freeze({
  yt: 'assets/images/site-search/glyph-yt.svg',
  bb: 'assets/images/site-search/glyph-bb.svg',
  gh: 'assets/images/site-search/glyph-gh.svg',
  sf: 'assets/images/site-search/glyph-sf.svg',
  mdn: 'assets/images/site-search/glyph-mdn.svg',
  npm: 'assets/images/site-search/glyph-npm.svg',
  hf: 'assets/images/site-search/glyph-hf.png',
  gs: 'assets/images/site-search/glyph-gs.png',
  ss: 'assets/images/site-search/glyph-ss.svg',
  maps: 'assets/images/site-search/glyph-maps.png',
  gpt: 'assets/images/site-search/glyph-gpt.svg',
  gm: 'assets/images/site-search/glyph-gm.svg',
  dbai: 'assets/images/site-search/glyph-dbai.png',
  qw: 'assets/images/site-search/glyph-qw.png',
  yb: 'assets/images/site-search/glyph-yb.svg',
  mx: 'assets/images/site-search/glyph-mx.png',
  ds: 'assets/images/site-search/glyph-ds.svg',
  kimi: 'assets/images/site-search/glyph-kimi.svg',
  cp: 'assets/images/site-search/glyph-cp.svg',
  grok: 'assets/images/site-search/glyph-grok.svg',
  qwen: 'assets/images/site-search/glyph-qwen.svg',
  ais: 'assets/images/site-search/glyph-ais.svg',
  pplx: 'assets/images/site-search/glyph-pplx.svg',
  metaso: 'assets/images/site-search/glyph-metaso.png',
  felo: 'assets/images/site-search/glyph-felo.svg',
  bd: 'assets/images/site-search/glyph-bd.svg',
  bi: 'assets/images/site-search/glyph-bi.svg',
  gg: 'assets/images/site-search/glyph-gg.svg',
  kg: 'assets/images/site-search/glyph-kg.png',
  ddg: 'assets/images/site-search/glyph-ddg.svg',
  br: 'assets/images/site-search/glyph-br.svg',
  eco: 'assets/images/site-search/glyph-eco.svg',
  sg: 'assets/images/site-search/glyph-sg.svg',
  yh: 'assets/images/site-search/glyph-yh.svg',
  yx: 'assets/images/site-search/glyph-yx.svg',
  sm: 'assets/images/site-search/glyph-sm.png',
  ybs: 'assets/images/site-search/glyph-ybs.svg',
  zh: 'assets/images/site-search/glyph-zh.png',
  db: 'assets/images/site-search/glyph-db.svg',
  jj: 'assets/images/site-search/glyph-jj.svg',
  wx: 'assets/images/site-search/glyph-wx.svg',
  tb: 'assets/images/site-search/glyph-tb.png',
  tm: 'assets/images/site-search/glyph-tm.png',
  tw: 'assets/images/site-search/glyph-tw.svg',
  rd: 'assets/images/site-search/glyph-rd.png',
  wb: 'assets/images/site-search/glyph-wb.png',
  xhs: 'assets/images/site-search/glyph-xhs.png',
  dy: 'assets/images/site-search/glyph-dy.png',
  jd: 'assets/images/site-search/glyph-jd.png',
  wk: 'assets/images/site-search/glyph-wk.svg',
  zw: 'assets/images/site-search/glyph-zw.svg',
  lm: 'assets/images/site-search/glyph-lm.png'
});
// A provider's search often runs on its own subdomain (search.bilibili.com),
// so list the hosts people actually save as shortcuts for the same brand.
const SHORTCUT_ICON_SITE_HOSTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  yt: Object.freeze(['m.youtube.com', 'youtu.be']),
  bb: Object.freeze(['bilibili.com', 'm.bilibili.com', 'space.bilibili.com']),
  maps: Object.freeze(['maps.google.com']),
  gpt: Object.freeze(['chat.openai.com']),
  ds: Object.freeze(['deepseek.com']),
  kimi: Object.freeze(['kimi.moonshot.cn']),
  cp: Object.freeze(['copilot.microsoft.com']),
  bd: Object.freeze(['m.baidu.com']),
  bi: Object.freeze(['cn.bing.com']),
  gg: Object.freeze(['google.com.hk']),
  yh: Object.freeze(['yahoo.com']),
  yx: Object.freeze(['yandex.ru', 'ya.ru']),
  sm: Object.freeze(['sm.cn']),
  zh: Object.freeze(['zhuanlan.zhihu.com']),
  db: Object.freeze(['movie.douban.com', 'book.douban.com', 'music.douban.com']),
  tb: Object.freeze(['taobao.com']),
  tm: Object.freeze(['tmall.com']),
  tw: Object.freeze(['twitter.com']),
  rd: Object.freeze(['old.reddit.com']),
  wb: Object.freeze(['weibo.com', 'm.weibo.cn']),
  jd: Object.freeze(['jd.com']),
  wk: Object.freeze(['wikipedia.org', 'en.m.wikipedia.org']),
  zw: Object.freeze(['zh.m.wikipedia.org'])
});
// Products that share a host with another provider only own their section.
const SHORTCUT_ICON_PATH_SCOPES: Readonly<Record<string, string>> = Object.freeze({
  maps: '/maps'
});



function getSiteSearchProviderPageUrl(provider: IconProvider | null | undefined): string {
  const template = provider && provider.template ? String(provider.template).trim() : '';
  if (!template) {
    return '';
  }
  try {
    const parsed = new URL(template.replace(/\{query\}/g, 'test'));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return `${parsed.origin}/`;
  } catch (_error) {
    return '';
  }
}

function getSiteSearchProviderExplicitIcon(provider: IconProvider | null | undefined): string {
  return String(provider && (provider.icon || provider.iconUrl) || '').trim();
}

function getProviderAssetKey(provider: IconProvider | null | undefined): string {
  return String(provider && (provider.builtinKey || provider.key) || '').trim().toLowerCase();
}

function getSiteSearchPinnedIconAssetPath(provider: IconProvider | null | undefined): string {
  return lookup(SITE_SEARCH_PINNED_ICON_ASSETS, getProviderAssetKey(provider)) || '';
}

function getSiteSearchIconAssetPath(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  try {
    return new URL(raw, 'https://lumno.invalid/').pathname.replace(/^\/+/, '');
  } catch (_error) {
    return raw.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  }
}

function isSiteSearchPinnedIconAssetUrl(value: unknown): boolean {
  const assetPath = getSiteSearchIconAssetPath(value);
  return Boolean(
    assetPath && Object.values(SITE_SEARCH_PINNED_ICON_ASSETS).includes(assetPath)
  );
}

function shouldHydrateSiteSearchProviderIcon(value: unknown): boolean {
  const iconUrl = String(value || '').trim();
  return Boolean(
    iconUrl &&
    !iconUrl.startsWith('data:') &&
    !isSiteSearchPinnedIconAssetUrl(iconUrl)
  );
}

// Swaps a provider icon for its saved image once that is available; bundled
// artwork and data URLs are shown as they are.
function createSiteSearchProviderIconHydrator<I, H>(
  attachFaviconData: ((icon: I, iconUrl: string, iconHost: H) => void) | null | undefined
): (icon: I, iconUrl: unknown, iconHost: H) => boolean {
  const attach = typeof attachFaviconData === 'function' ? attachFaviconData : null;
  return function hydrateSiteSearchProviderIcon(icon: I, iconUrl: unknown, iconHost: H): boolean {
    const resolvedIconUrl = String(iconUrl || '').trim();
    if (!attach || !shouldHydrateSiteSearchProviderIcon(resolvedIconUrl)) {
      return false;
    }
    attach(icon, resolvedIconUrl, iconHost);
    return true;
  };
}

function getPinnedSiteSearchProviderIcon(provider: IconProvider | null | undefined): string {
  const explicitIcon = getSiteSearchProviderExplicitIcon(provider);
  if (!explicitIcon) {
    return '';
  }
  const providerKey = String(provider && provider.key || '').trim().toLowerCase();
  return providerKey === 'gg' && explicitIcon === GOOGLE_BRAND_ICON_URL
    ? explicitIcon
    : '';
}

function getSiteSearchProviderIcon(
  cacheMap: unknown,
  provider: IconProvider | null | undefined,
  nowValue?: unknown,
  options?: SiteSearchIconOptions | null
): string {
  const pinnedAssetPath = getSiteSearchPinnedIconAssetPath(provider);
  const resolveAssetUrl = options && typeof options.resolveAssetUrl === 'function'
    ? options.resolveAssetUrl
    : null;
  if (pinnedAssetPath && resolveAssetUrl) {
    const assetUrl = String(resolveAssetUrl(pinnedAssetPath) || '').trim();
    if (assetUrl) {
      return assetUrl;
    }
  }
  const pageUrl = getSiteSearchProviderPageUrl(provider);
  const cacheKey = getCacheKey(pageUrl);
  const normalizedCache = normalizeCacheMap(cacheMap, nowValue, options);
  const cachedEntry = cacheKey ? lookup(normalizedCache, cacheKey) : undefined;
  const pinnedIcon = getPinnedSiteSearchProviderIcon(provider);
  if (cachedEntry && cachedEntry.dataUrl) {
    const cachedSource = normalizePageUrl(cachedEntry.sourceUrl);
    const pinnedSource = normalizePageUrl(pinnedIcon);
    if (!pinnedSource || cachedSource === pinnedSource) {
      return cachedEntry.dataUrl;
    }
  }
  return pinnedIcon || getSiteSearchProviderExplicitIcon(provider);
}

function getHttpHost(url: unknown): string {
  try {
    const parsed = new URL(String(url || ''));
    return /^https?:$/.test(parsed.protocol)
      ? parsed.hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch (_error) {
    return '';
  }
}

// The bundled artwork for a shortcut to a site a provider stands for, or ''.
function getBundledShortcutIconAssetPath(pageUrl: unknown, providers: readonly IconProvider[] | null | undefined): string {
  const host = getHttpHost(pageUrl);
  if (!host) {
    return '';
  }
  const pathname = new URL(String(pageUrl)).pathname;
  const matchesSearchHost = (item: IconProvider): boolean => {
    const scope = lookup(SHORTCUT_ICON_PATH_SCOPES, getProviderAssetKey(item));
    return getHttpHost(getSiteSearchProviderPageUrl(item)) === host &&
      (!scope || pathname === scope || pathname.startsWith(`${scope}/`));
  };
  const candidates = (Array.isArray(providers) ? providers : []).filter((item) => (
    getSiteSearchPinnedIconAssetPath(item) &&
    (matchesSearchHost(item) || (lookup(SHORTCUT_ICON_SITE_HOSTS, getProviderAssetKey(item)) || []).includes(host))
  ));
  // A path-scoped product (Google Maps) wins inside its section; elsewhere
  // on a shared host the site's own artwork applies.
  const provider = candidates.find((item) => lookup(SHORTCUT_ICON_PATH_SCOPES, getProviderAssetKey(item))) || candidates[0];
  return lookup(SHORTCUT_PINNED_ICON_ASSETS, getProviderAssetKey(provider)) || '';
}

export {
  GOOGLE_BRAND_ICON_URL,
  SHORTCUT_ICON_PATH_SCOPES,
  SHORTCUT_ICON_SITE_HOSTS,
  SHORTCUT_PINNED_ICON_ASSETS,
  SITE_SEARCH_PINNED_ICON_ASSETS,
  createSiteSearchProviderIconHydrator,
  getBundledShortcutIconAssetPath,
  getHttpHost,
  getPinnedSiteSearchProviderIcon,
  getProviderAssetKey,
  getSiteSearchIconAssetPath,
  getSiteSearchPinnedIconAssetPath,
  getSiteSearchProviderExplicitIcon,
  getSiteSearchProviderIcon,
  getSiteSearchProviderPageUrl,
  isSiteSearchPinnedIconAssetUrl,
  shouldHydrateSiteSearchProviderIcon
};
