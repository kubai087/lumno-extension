// The Options page language: the chosen mode ('system' or a language), the
// locale it resolves to, and that locale's messages. This is its one owner;
// it follows the language setting, and views read their copy through it and
// redraw when its store changes.
import { readLocaleMessages } from '../../../domain/locale-messages';
import type { LocaleMessage } from '../../../domain/messages';
import { language as languageSetting, localeToHtmlLang, normalizeLocale } from '../../../domain/settings/locale';
import * as LumnoMessaging from '../../../platform/messaging';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';

type LocaleMessages = Record<string, LocaleMessage>;

interface OptionsLocaleState {
  // The stored choice: 'system' or a language's html lang.
  mode: string;
  // What the page shows.
  locale: string;
  // Null until the locale's messages load; the browser's own then answer.
  messages: LocaleMessages | null;
}

function getSystemLocale(): string {
  if (chrome.i18n && chrome.i18n.getUILanguage) {
    return normalizeLocale(chrome.i18n.getUILanguage());
  }
  return normalizeLocale(navigator.language || 'en');
}

function resolveLocale(mode: string): string {
  return mode === 'system' ? getSystemLocale() : normalizeLocale(mode);
}

// A locale's messages from the extension, or from the worker when the page
// cannot fetch them.
function loadLocaleMessages(locale: string): Promise<LocaleMessages> {
  const normalized = normalizeLocale(locale);
  const fetchFromBackground = (): Promise<LocaleMessages> => new Promise((resolve) => {
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getLocaleMessages', locale: normalized }, (response) => {
      resolve(chrome.runtime.lastError ? {} : readLocaleMessages(response ? response.messages : undefined));
    });
  });
  return fetch(chrome.runtime.getURL(`_locales/${normalized}/messages.json`), { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('locale fetch failed');
      }
      return response.json();
    })
    .then((messages: unknown) => readLocaleMessages(messages))
    .catch(() => fetchFromBackground());
}

class OptionsLocale {
  readonly store: Store<OptionsLocaleState>;
  private readonly settingsStore: Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>;
  private applyRequest = 0;

  constructor(settingsStore: Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>) {
    this.settingsStore = settingsStore;
    this.store = createStore<OptionsLocaleState>({ mode: 'system', locale: getSystemLocale(), messages: null });
  }

  // The message in the page's language; with the system setting the
  // browser's own messages answer until the locale's load.
  readonly getMessage = (key: string, fallback: string): string => {
    const { mode, messages } = this.store.getSnapshot();
    if (messages && Object.prototype.hasOwnProperty.call(messages, key)) {
      const entry = messages[key];
      if (entry && typeof entry.message === 'string') {
        return entry.message;
      }
    }
    if (mode === 'system' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  };

  // Shows the stored language once read, and every change to it. With
  // nothing stored the page shows the system language without writing it,
  // so a choice another page is still saving is not overwritten.
  follow(): void {
    void this.settingsStore.include(languageSetting).then(() => this.apply(this.settingsStore.get(languageSetting)));
    this.settingsStore.subscribe(languageSetting, () => this.apply(this.settingsStore.get(languageSetting)));
  }

  // The reader's own choice: shown and saved.
  choose(mode: unknown): void {
    const normalizedMode = languageSetting.parse(mode);
    void this.settingsStore.set(languageSetting, normalizedMode).catch(() => {});
    this.apply(normalizedMode);
  }

  // The document language changes at once; the copy once the messages
  // load, unless a newer choice came first.
  private apply(mode: unknown): void {
    const request = ++this.applyRequest;
    const normalizedMode = languageSetting.parse(mode);
    const locale = resolveLocale(normalizedMode);
    if (document.documentElement) {
      document.documentElement.lang = localeToHtmlLang(locale);
    }
    void loadLocaleMessages(locale).then((messages) => {
      if (request === this.applyRequest) {
        this.store.setState({ mode: normalizedMode, locale, messages });
      }
    });
  }
}

export { OptionsLocale, getSystemLocale, loadLocaleMessages, resolveLocale };
export type { LocaleMessages, OptionsLocaleState };
