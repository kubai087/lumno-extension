// A locale's messages from the extension's own file, or through the worker
// when this copy of the extension can no longer fetch its files (it was
// reloaded under an open page); {} when neither works.
import { readLocaleMessages } from '../../domain/locale-messages';
import type { LocaleMessage } from '../../domain/messages';
import { normalizeLocale } from '../../domain/settings/locale';
import * as LumnoMessaging from '../../platform/messaging';

type LocaleMessages = Record<string, LocaleMessage>;

// An extension address on the "invalid" host: the extension was reloaded
// and this copy of it can no longer reach its own files.
function isInvalidExtensionResourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^(chrome|moz|ms-browser)-extension:$/i.test(parsed.protocol) && parsed.hostname.toLowerCase() === 'invalid';
  } catch (_error) {
    return false;
  }
}

function loadViaWorker(locale: string): Promise<LocaleMessages> {
  return new Promise((resolve) => {
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getLocaleMessages', locale }, (response) => {
        resolve(chrome.runtime.lastError ? {} : readLocaleMessages(response ? response.messages : undefined));
      });
    } catch (_error) {
      resolve({});
    }
  });
}

function loadExtensionLocaleMessages(locale: string): Promise<LocaleMessages> {
  if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return Promise.resolve({});
  }
  const normalized = normalizeLocale(locale);
  const path = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
  if (isInvalidExtensionResourceUrl(path)) {
    return loadViaWorker(normalized);
  }
  return fetch(path, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('locale fetch failed');
      }
      return response.json();
    })
    .then((messages: unknown) => readLocaleMessages(messages))
    .catch(() => loadViaWorker(normalized));
}

export { loadExtensionLocaleMessages };
export type { LocaleMessages };
