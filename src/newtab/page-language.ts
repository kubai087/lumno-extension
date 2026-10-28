// Where New Tab reads a locale's messages: the copy the page preload started
// fetching for the last New Tab's language, else the extension's file.
import { normalizeLocale } from '../domain/settings/locale';
import { takeBootValue } from '../platform/boot-handoff';
import { readLocaleMessages } from '../domain/locale-messages';
import { loadExtensionLocaleMessages } from '../shared/i18n/locale-messages';
import type { LocaleMessages } from '../shared/i18n/locale-messages';

function loadNewtabLocaleMessages(locale: string): Promise<LocaleMessages> {
  const normalized = normalizeLocale(locale);
  // newtab-storage-prefetch.ts started the last New Tab's locale before this script loaded.
  const prefetch = takeBootValue('localePrefetch');
  if (prefetch && prefetch.locale === normalized) {
    return prefetch.messages.then((value) => readLocaleMessages(value), () => loadExtensionLocaleMessages(normalized));
  }
  return loadExtensionLocaleMessages(normalized);
}

export { loadNewtabLocaleMessages };
