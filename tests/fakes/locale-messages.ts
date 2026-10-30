// The written languages' messages (_locales/<locale>/messages.json), for
// checks that every string a surface asks for exists in each of them.
import enMessages from '../../_locales/en/messages.json';
import jaMessages from '../../_locales/ja/messages.json';
import zhCnMessages from '../../_locales/zh_CN/messages.json';
import zhTwMessages from '../../_locales/zh_TW/messages.json';

type Messages = Record<string, { message: string } | undefined>;

const WRITTEN_LOCALE_MESSAGES: Readonly<Record<string, Messages>> = {
  en: enMessages,
  ja: jaMessages,
  zh_CN: zhCnMessages,
  zh_TW: zhTwMessages
};

// "<locale>: <key>" for each key a written language lacks or leaves blank.
export function missingMessages(keys: Iterable<string>): string[] {
  const list = Array.from(keys);
  return Object.entries(WRITTEN_LOCALE_MESSAGES).flatMap(([locale, messages]) =>
    list.filter((key) => !String(messages[key]?.message || '').trim()).map((key) => `${locale}: ${key}`));
}
