// How the Search sources tab names a provider and which icon it shows:
// built-ins by their localized name and bundled icon, custom providers by
// what the reader gave them, and otherwise the site's favicon.
import * as BundledIcons from '../../../domain/favicon/shortcut-favicon/bundled-icons';
import type { SiteSearchProvider } from '../../../domain/search/types';
import * as SearchSiteSearchProviders from '../../../domain/search/utils/site-search-providers';
import type { GetMessage } from '../../options-types';

// A provider as a list shows it: built-in or custom. Providers the lists
// get from elsewhere (the aggregate searches) count as built-in.
type ListedSiteSearchProvider = SiteSearchProvider & { _xIsCustom?: boolean };

function getProviderName(t: GetMessage, item: ListedSiteSearchProvider | null): string {
  if (!item || item._xIsCustom) {
    return item ? (item.name || item.key) : '';
  }
  const mapping = SearchSiteSearchProviders.getSiteSearchProviderDisplayNameMessage(item);
  if (!mapping) {
    return item.name || item.key;
  }
  return t(mapping.messageKey, mapping.fallback);
}

function getProviderIconUrl(item: ListedSiteSearchProvider | null): string {
  if (!item) {
    return '';
  }
  const localIconAsset = !item._xIsCustom
    ? BundledIcons.getSiteSearchPinnedIconAssetPath(item)
    : '';
  if (localIconAsset) {
    return chrome.runtime.getURL(localIconAsset);
  }
  if (item.icon) {
    return item.icon.trim();
  }
  if (item.iconUrl) {
    return item.iconUrl.trim();
  }
  try {
    const template = SearchSiteSearchProviders.normalizeSiteSearchTemplate(String(item.template || '').trim());
    const url = template.replace(/\{query\}/g, 'test');
    const hostname = new URL(url).hostname;
    return hostname
      ? `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(`https://${hostname}/`)}&size=64`
      : '';
  } catch (error) {
    return '';
  }
}

export { getProviderIconUrl, getProviderName };
export type { ListedSiteSearchProvider };
