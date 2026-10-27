// The popup's language: the one chosen in Lumno, or the browser's under the
// system setting, with its messages loaded once when the popup opens.
import * as LocaleSettings from '../domain/settings/locale';
import { readLocaleMessages } from '../domain/locale-messages';
import type { LocaleMessage } from '../domain/messages';
import type { Translate } from './model';

interface PopupLocale {
  // The html lang value.
  lang: string;
  t: Translate;
}

function loadMessages(chromeApi: typeof chrome, locale: string): Promise<Record<string, LocaleMessage>> {
  return fetch(chromeApi.runtime.getURL(`_locales/${locale}/messages.json`))
    .then((response) => (response.ok ? response.json() : {}))
    .then((value: unknown) => readLocaleMessages(value))
    .catch(() => ({}));
}

async function loadPopupLocale(chromeApi: typeof chrome, languageMode: string): Promise<PopupLocale> {
  const uiLanguage = chromeApi.i18n && chromeApi.i18n.getUILanguage ? chromeApi.i18n.getUILanguage() : 'en';
  const locale = LocaleSettings.normalizeLocale(languageMode === 'system' ? uiLanguage : languageMode);
  const messages = await loadMessages(chromeApi, locale);
  function t(key: string, fallback: string): string {
    const entry = Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : undefined;
    if (entry && typeof entry.message === 'string') {
      return entry.message;
    }
    if (languageMode === 'system' && chromeApi.i18n && chromeApi.i18n.getMessage) {
      const message = chromeApi.i18n.getMessage(key);
      if (message) return message;
    }
    return fallback;
  }
  return { lang: LocaleSettings.localeToHtmlLang(locale), t };
}

export { loadPopupLocale };
export type { PopupLocale };
