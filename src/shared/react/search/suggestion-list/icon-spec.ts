// Which icon a suggestion row draws: its site's favicon, the browser's own
// for browser pages, or a glyph for searches, commands and typed addresses.
import type { RemixIconName } from '../../../ui/remix-icon';
import type { IconSpec, NormalizedOptions, Suggestion } from './types';

// The icon each feedback row draws, by the link it opens.
const FEEDBACK_ICONS: Readonly<Record<string, RemixIconName>> = {
  community: 'ri-wechat-line',
  'github-issue': 'ri-github-line',
  'contact-author': 'ri-twitter-x-line'
};

// The glyphs of commands and searches, drawn in the subtext color.
const GLYPH_ICONS: Readonly<Record<string, RemixIconName>> = {
  newtab: 'ri-search-line',
  googleSuggest: 'ri-search-line',
  commandNewTab: 'ri-add-line',
  commandSettings: 'ri-settings-3-line',
  commandDocumentPip: 'ri-scissors-cut-line',
  webAppearanceSwitch: 'ri-contrast-2-line'
};

// Rows whose favicon may be a remote image (a site search provider's).
const REMOTE_ICON_TYPES = new Set(['siteSearch', 'inlineSiteSearch', 'siteSearchPrompt', 'helpArticle']);

function getBrowserFallbackIcon(options: NormalizedOptions, url: string): RemixIconName | undefined {
  return options.isBrowserNewtabUrl(url) || options.isBrowserInternalUrl(url) ? 'ri-link' : undefined;
}

function readBrowserPageIcon(options: NormalizedOptions, url: string, host: string, favicon: string): IconSpec {
  if (favicon || options.isBrowserInternalUrl(url)) {
    return {
      kind: 'favicon',
      attach: true,
      url,
      host,
      favicon,
      objectFitContain: true,
      fallbackIconName: getBrowserFallbackIcon(options, url)
    };
  }
  return { kind: 'inline', iconName: 'ri-window-2-line' };
}

// A site's row: its favicon, unless its host may not load one.
function readSiteIcon(options: NormalizedOptions, type: string, url: string, host: string, favicon: string): IconSpec {
  const blocked = Boolean(host && options.shouldBlockFaviconForHost(host));
  if (favicon && REMOTE_ICON_TYPES.has(type)) {
    return { kind: 'favicon', attach: true, url, host, favicon, allowRemoteImage: true, objectFitContain: true };
  }
  if (favicon && !blocked) {
    return { kind: 'favicon', attach: true, url: url || favicon, host, favicon, objectFitContain: true };
  }
  if (favicon) {
    return { kind: 'inline', iconName: 'ri-link' };
  }
  return { kind: 'inline', iconName: blocked ? 'ri-link' : 'ri-search-line', tone: 'subtext' };
}

function getSuggestionIconSpec(options: NormalizedOptions, suggestion: Suggestion): IconSpec {
  const type = suggestion.type || '';
  const url = String(suggestion.url || '');
  const favicon = String(suggestion.favicon || '');
  const host = url ? options.getHostFromUrl(url) : '';
  if (type === 'directUrl') {
    return { kind: 'inline', iconName: 'ri-link' };
  }
  if (type === 'browserPage') {
    return readBrowserPageIcon(options, url, host, favicon);
  }
  if (Object.prototype.hasOwnProperty.call(GLYPH_ICONS, type)) {
    return { kind: 'inline', iconName: GLYPH_ICONS[type], tone: 'subtext' };
  }
  if ((type === 'modeSwitch' || type === 'zenSwitch' || type === 'presentationSwitch') && favicon) {
    return { kind: 'favicon', src: favicon, fallbackIconName: 'ri-link' };
  }
  if (type === 'helpFeedback') {
    return { kind: 'inline', iconName: FEEDBACK_ICONS[suggestion.feedbackKey || ''] || 'ri-feedback-line', tone: 'subtext' };
  }
  return readSiteIcon(options, type, url, host, favicon);
}

export { getBrowserFallbackIcon, getSuggestionIconSpec };
