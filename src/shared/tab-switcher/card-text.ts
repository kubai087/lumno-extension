// The text and colors a switcher card shows for its tab.
import type { TabSwitcherTab } from '../react/tab-switcher-options';

const THUMBNAIL_STATUSES = new Set(['ok', 'pending', 'failed', 'restricted', 'stale']);

function getMessage(key: string, fallback: string): string {
  try {
    if (chrome && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
      return chrome.i18n.getMessage(key) || fallback;
    }
  } catch (_error) {
    // Ignore i18n failures in page context.
  }
  return fallback;
}

function sanitizeText(value: unknown, fallback?: string): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback || '';
}

function getHostLabel(url: string): string {
  try {
    const parsed = new URL(url);
    // An extension page's host is an opaque ID (a per-install UUID in Firefox).
    if (/^(?:chrome|moz)-extension:$/.test(parsed.protocol)) {
      return getMessage('extension_page_label', 'Extension page');
    }
    return parsed.hostname.replace(/^www\./i, '');
  } catch (_error) {
    return '';
  }
}

function getThumbnailStatus(tab: TabSwitcherTab, thumbnail: string): string {
  const status = String(tab && tab.thumbnailStatus ? tab.thumbnailStatus : '').trim().toLowerCase();
  if (THUMBNAIL_STATUSES.has(status)) {
    return status;
  }
  return thumbnail && thumbnail.startsWith('data:image/') ? 'ok' : 'missing';
}

function normalizeAccentCss(value: unknown): string {
  if (!Array.isArray(value) || value.length !== 3) {
    return '';
  }
  const rgb = value.map((channel) => Math.round(Number(channel)));
  if (!rgb.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)) {
    return '';
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export { getHostLabel, getMessage, getThumbnailStatus, normalizeAccentCss, sanitizeText };
