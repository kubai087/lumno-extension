import { language, normalizeLocale } from '../domain/settings/locale';
import type { SettingsStore } from '../platform/settings-store';
import type { LocaleMessage } from '../domain/messages';
import type { createReadLaterController } from './read-later';
import type { createController } from './page-shortcut-menu';

export function startReadLaterMenu(
  controller: ReturnType<typeof createReadLaterController>,
  settings: SettingsStore,
  loadMessages: (locale: string) => Promise<Record<string, LocaleMessage>>,
  toast: ReturnType<typeof createController> | null
): void {
  if (!chrome.contextMenus) return;
  const id = 'lumno-read-later';
  let messages: Record<string, LocaleMessage> = {};
  const t = (key: string, fallback: string) => messages[key]?.message || fallback;
  async function refresh(): Promise<void> {
    await settings.include(language);
    const selected = settings.get(language);
    const locale = normalizeLocale(selected === 'system' ? chrome.i18n.getUILanguage() : selected);
    messages = await loadMessages(locale);
    const properties: chrome.contextMenus.CreateProperties = {
      title: t('read_later_add', 'Add to Read later'), contexts: ['page', 'link'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    };
    chrome.contextMenus.update(id, properties, () => {
      if (chrome.runtime.lastError) chrome.contextMenus.create({ id, ...properties }, () => { void chrome.runtime.lastError; });
    });
  }
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== id) return;
    const url = info.linkUrl || info.pageUrl || tab?.url || '';
    const title = info.linkUrl ? (info.selectionText || '') : (tab?.title || '');
    void controller.add({ url, title }).then((result) => {
      const message = result.status === 'added' ? t('read_later_added', 'Added to Read later')
        : result.status === 'limit' ? t('recent_pin_limit_toast', 'You can pin up to 3 cards.') : t('toast_error', 'Action failed. Try again.');
      void toast?.showToast(tab?.id, { message, error: result.status !== 'added' });
    });
  });
  settings.subscribe(language, () => { void refresh().catch(() => {}); });
  void refresh().catch(() => {});
}
