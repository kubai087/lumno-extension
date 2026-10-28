// A surface's language: the chosen mode ('system' or a language), the
// locale it resolves to, and that locale's messages. This is its one
// owner; the surface follows the language setting through it, reads its
// copy through t() and formatMessage(), and redraws when its store
// changes. Where the messages come from is the surface's: a page fetches
// its own files, an injected app may have to ask the worker.
import type { LocaleMessage } from '../../domain/messages';
import { language as languageSetting, normalizeLocale } from '../../domain/settings/locale';
import type { SettingsStore } from '../../platform/settings-store';
import { createStore } from '../state/store';
import type { Store } from '../state/store';

type LocaleMessages = Record<string, LocaleMessage>;

interface SurfaceLocaleState {
  // The stored choice: 'system' or a language's html lang.
  mode: string;
  // What the surface shows; it moves as soon as the mode does.
  locale: string;
  // Null until the locale's messages load; the browser's own then answer.
  messages: LocaleMessages | null;
}

type LocaleSettings = Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>;

function getSystemLocale(): string {
  if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
    return normalizeLocale(chrome.i18n.getUILanguage());
  }
  return normalizeLocale(navigator.language || 'en');
}

function resolveLocale(mode: string): string {
  return mode === 'system' ? getSystemLocale() : normalizeLocale(mode);
}

class SurfaceLocale {
  readonly store: Store<SurfaceLocaleState>;
  // Settles once the first messages are in.
  ready: Promise<void> = Promise.resolve();
  private readonly settings: LocaleSettings;
  private readonly loadMessages: (locale: string) => Promise<LocaleMessages>;
  private applyRequest = 0;

  constructor(settings: LocaleSettings, loadMessages: (locale: string) => Promise<LocaleMessages>) {
    this.settings = settings;
    this.loadMessages = loadMessages;
    this.store = createStore<SurfaceLocaleState>({ mode: 'system', locale: getSystemLocale(), messages: null });
  }

  // The message in the surface's language; the browser's own messages
  // answer what the locale's lack, and until they load.
  readonly t = (key: string, fallback: string): string => {
    const { messages } = this.store.getSnapshot();
    const entry = messages && Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : undefined;
    if (entry && typeof entry.message === 'string' && entry.message) {
      return entry.message;
    }
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  };

  readonly formatMessage = (key: string, fallback: string, values?: Readonly<Record<string, string | number>>): string => {
    const text = this.t(key, fallback);
    return values
      ? text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => (Object.hasOwn(values, name) ? String(values[name]) : match))
      : text;
  };

  // Shows the stored language once read, and every change to it, until
  // the returned function stops it. With nothing stored the surface shows
  // the system language without writing it.
  follow(): () => void {
    const unsubscribe = this.settings.subscribe(languageSetting, () => void this.apply(this.settings.get(languageSetting)));
    this.ready = this.settings.include(languageSetting).then(() => this.apply(this.settings.get(languageSetting)));
    return unsubscribe;
  }

  // The reader's own choice: shown and saved.
  choose(mode: unknown): void {
    const normalizedMode = languageSetting.parse(mode);
    void this.settings.set(languageSetting, normalizedMode).catch(() => {});
    void this.apply(normalizedMode);
  }

  // The locale moves at once; the messages once they load, unless a newer
  // choice came first.
  private apply(mode: unknown): Promise<void> {
    const request = ++this.applyRequest;
    const normalizedMode = languageSetting.parse(mode);
    const locale = resolveLocale(normalizedMode);
    this.store.setState({ mode: normalizedMode, locale });
    return this.loadMessages(locale).catch((): LocaleMessages => ({})).then((messages) => {
      if (request === this.applyRequest) {
        this.store.setState({ messages });
      }
    });
  }
}

export { SurfaceLocale, getSystemLocale, resolveLocale };
export type { LocaleMessages, SurfaceLocaleState };
